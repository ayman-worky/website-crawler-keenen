from typing import Any, List, Optional

from fastapi import APIRouter, HTTPException, Query, Path, Body, BackgroundTasks, Depends
from sqlmodel import select, func

from app.api.deps import CurrentUser, SessionDep
from app.models import CrawledURL, URLAnalysis
from pydantic import BaseModel

router = APIRouter(prefix="/urls", tags=["urls"])

@router.post("/", response_model=CrawledURL)
def add_url(
    *, session: SessionDep, current_user: CurrentUser, url: str
) -> Any:
    """
    Add a new URL for analysis (user-specific).
    """
    # Check for duplicate for this user
    statement = select(CrawledURL).where(CrawledURL.user_id == current_user.id, CrawledURL.url == url)
    existing = session.exec(statement).first()
    if existing:
        raise HTTPException(status_code=400, detail="URL already submitted.")
    crawled_url = CrawledURL(url=url, user_id=current_user.id)
    session.add(crawled_url)
    session.commit()
    session.refresh(crawled_url)
    return crawled_url

@router.get("/", response_model=List[CrawledURL])
def list_urls(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = Query(100, le=100),
    sort_by: str = Query("created_at", regex="^(url|status|created_at)$"),
    sort_order: str = Query("desc", regex="^(asc|desc)$"),
    status: Optional[str] = None,
    search: Optional[str] = None,
) -> Any:
    """
    List URLs for the current user (paginated, sortable, filterable, searchable).
    """
    statement = select(CrawledURL).where(CrawledURL.user_id == current_user.id)
    if status:
        statement = statement.where(CrawledURL.status == status)
    if search:
        statement = statement.where(CrawledURL.url.contains(search))
    # Sorting
    sort_column = getattr(CrawledURL, sort_by)
    if sort_order == "desc":
        sort_column = sort_column.desc()
    statement = statement.order_by(sort_column)
    statement = statement.offset(skip).limit(limit)
    urls = session.exec(statement).all()
    return urls

@router.get("/stats", response_model=dict)
def url_stats(session: SessionDep, current_user: CurrentUser):
    statement = select(CrawledURL.status, func.count()).where(CrawledURL.user_id == current_user.id).group_by(CrawledURL.status)
    results = session.exec(statement).all()
    by_status = {status: count for status, count in results}
    total = sum(by_status.values())
    return {"total": total, "by_status": by_status}

@router.get("/{id}", response_model=URLAnalysis)
def get_url_analysis(
    *, session: SessionDep, current_user: CurrentUser, id: int = Path(...)
) -> Any:
    """
    Get analysis results for a specific URL (user-specific).
    """
    url = session.get(CrawledURL, id)
    if not url or url.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="URL not found")
    if not url.analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return url.analysis

@router.post("/{id}/start", response_model=CrawledURL)
def start_crawl(
    *, session: SessionDep, current_user: CurrentUser, id: int = Path(...), background_tasks: BackgroundTasks
) -> Any:
    """
    Start processing/crawling a URL (set status to 'running' and analyze in background).
    """
    url = session.get(CrawledURL, id)
    if not url or url.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="URL not found")
    url.status = "running"
    session.add(url)
    session.commit()
    session.refresh(url)
    background_tasks.add_task(run_analysis, url.id)
    return url

@router.post("/{id}/stop", response_model=CrawledURL)
def stop_crawl(
    *, session: SessionDep, current_user: CurrentUser, id: int = Path(...)
) -> Any:
    """
    Stop processing a URL (set status to 'stopped').
    """
    url = session.get(CrawledURL, id)
    if not url or url.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="URL not found")
    url.status = "stopped"
    session.add(url)
    session.commit()
    session.refresh(url)
    return url

class BulkIDs(BaseModel):
    ids: list[int]

@router.delete("/", response_model=dict)
def bulk_delete_urls(
    *, session: SessionDep, current_user: CurrentUser, ids: list[int] = Body(...)
) -> Any:
    """
    Bulk delete URLs by IDs (user-specific).
    """
    statement = select(CrawledURL).where(CrawledURL.user_id == current_user.id, CrawledURL.id.in_(ids))
    urls = session.exec(statement).all()
    for url in urls:
        session.delete(url)
    session.commit()
    return {"deleted": [url.id for url in urls]}

@router.post("/reanalyze", response_model=dict)
def bulk_reanalyze_urls(
    *, session: SessionDep, current_user: CurrentUser, ids: list[int] = Body(...)
) -> Any:
    """
    Bulk re-analyze URLs by IDs (set status to 'queued', user-specific).
    """
    statement = select(CrawledURL).where(CrawledURL.user_id == current_user.id, CrawledURL.id.in_(ids))
    urls = session.exec(statement).all()
    for url in urls:
        url.status = "queued"
        session.add(url)
    session.commit()
    return {"reanalyzed": [url.id for url in urls]}

# Background analysis worker
from app.utils import analyze_url
from app.models import URLAnalysis, BrokenLink, CrawledURL
from app.core.db import SessionLocal

def run_analysis(url_id: int):
    session = SessionLocal()
    url = session.get(CrawledURL, url_id)
    if not url:
        session.close()
        return
    try:
        result = analyze_url(url.url)
        analysis = URLAnalysis(
            crawled_url_id=url.id,
            html_version=result["html_version"],
            title=result["title"],
            h1_count=result["h1_count"],
            h2_count=result["h2_count"],
            h3_count=result["h3_count"],
            h4_count=result["h4_count"],
            h5_count=result["h5_count"],
            h6_count=result["h6_count"],
            internal_links_count=result["internal_links_count"],
            external_links_count=result["external_links_count"],
            inaccessible_links_count=len(result["inaccessible_links"]),
            has_login_form=result["has_login_form"],
        )
        session.add(analysis)
        session.commit()
        session.refresh(analysis)
        for link in result["inaccessible_links"]:
            broken = BrokenLink(
                analysis_id=analysis.id,
                link_url=link["link_url"],
                status_code=link["status_code"] or 0,
            )
            session.add(broken)
        url.status = "done"
    except Exception as e:
        url.status = "error"
    finally:
        session.commit()
        session.close() 