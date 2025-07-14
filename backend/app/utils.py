import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import emails  # type: ignore
import jwt
from jinja2 import Template
from jwt.exceptions import InvalidTokenError

import httpx
from bs4 import BeautifulSoup, Doctype
from urllib.parse import urlparse, urljoin

from app.core import security
from app.core.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class EmailData:
    html_content: str
    subject: str


def render_email_template(*, template_name: str, context: dict[str, Any]) -> str:
    template_str = (
        Path(__file__).parent / "email-templates" / "build" / template_name
    ).read_text()
    html_content = Template(template_str).render(context)
    return html_content


def send_email(
    *,
    email_to: str,
    subject: str = "",
    html_content: str = "",
) -> None:
    assert settings.emails_enabled, "no provided configuration for email variables"
    message = emails.Message(
        subject=subject,
        html=html_content,
        mail_from=(settings.EMAILS_FROM_NAME, settings.EMAILS_FROM_EMAIL),
    )
    smtp_options = {"host": settings.SMTP_HOST, "port": settings.SMTP_PORT}
    if settings.SMTP_TLS:
        smtp_options["tls"] = True
    elif settings.SMTP_SSL:
        smtp_options["ssl"] = True
    if settings.SMTP_USER:
        smtp_options["user"] = settings.SMTP_USER
    if settings.SMTP_PASSWORD:
        smtp_options["password"] = settings.SMTP_PASSWORD
    response = message.send(to=email_to, smtp=smtp_options)
    logger.info(f"send email result: {response}")


def generate_test_email(email_to: str) -> EmailData:
    project_name = settings.PROJECT_NAME
    subject = f"{project_name} - Test email"
    html_content = render_email_template(
        template_name="test_email.html",
        context={"project_name": settings.PROJECT_NAME, "email": email_to},
    )
    return EmailData(html_content=html_content, subject=subject)


def generate_reset_password_email(email_to: str, email: str, token: str) -> EmailData:
    project_name = settings.PROJECT_NAME
    subject = f"{project_name} - Password recovery for user {email}"
    link = f"{settings.FRONTEND_HOST}/reset-password?token={token}"
    html_content = render_email_template(
        template_name="reset_password.html",
        context={
            "project_name": settings.PROJECT_NAME,
            "username": email,
            "email": email_to,
            "valid_hours": settings.EMAIL_RESET_TOKEN_EXPIRE_HOURS,
            "link": link,
        },
    )
    return EmailData(html_content=html_content, subject=subject)


def generate_new_account_email(
    email_to: str, username: str, password: str
) -> EmailData:
    project_name = settings.PROJECT_NAME
    subject = f"{project_name} - New account for user {username}"
    html_content = render_email_template(
        template_name="new_account.html",
        context={
            "project_name": settings.PROJECT_NAME,
            "username": username,
            "password": password,
            "email": email_to,
            "link": settings.FRONTEND_HOST,
        },
    )
    return EmailData(html_content=html_content, subject=subject)


def generate_password_reset_token(email: str) -> str:
    delta = timedelta(hours=settings.EMAIL_RESET_TOKEN_EXPIRE_HOURS)
    now = datetime.now(timezone.utc)
    expires = now + delta
    exp = expires.timestamp()
    encoded_jwt = jwt.encode(
        {"exp": exp, "nbf": now, "sub": email},
        settings.SECRET_KEY,
        algorithm=security.ALGORITHM,
    )
    return encoded_jwt


def verify_password_reset_token(token: str) -> str | None:
    try:
        decoded_token = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[security.ALGORITHM]
        )
        return str(decoded_token["sub"])
    except InvalidTokenError:
        return None


def analyze_url(url: str):
    result = {
        "html_version": None,
        "title": None,
        "h1_count": 0,
        "h2_count": 0,
        "h3_count": 0,
        "h4_count": 0,
        "h5_count": 0,
        "h6_count": 0,
        "internal_links_count": 0,
        "external_links_count": 0,
        "inaccessible_links": [],
        "has_login_form": False,
    }
    try:
        resp = httpx.get(url, timeout=10)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "lxml")

        # HTML version
        doctype = next((item for item in soup.contents if isinstance(item, Doctype)), None)
        if doctype:
            result["html_version"] = str(doctype)
        else:
            result["html_version"] = "Unknown"

        # Title
        result["title"] = soup.title.string if soup.title else None

        # Heading counts
        for i in range(1, 7):
            result[f"h{i}_count"] = len(soup.find_all(f"h{i}"))

        # Links
        domain = urlparse(url).netloc
        links = soup.find_all("a", href=True)
        for link in links:
            href = link["href"]
            abs_url = urljoin(url, href)
            if urlparse(abs_url).netloc == domain:
                result["internal_links_count"] += 1
            else:
                result["external_links_count"] += 1

        # Inaccessible links
        for link in links:
            href = link["href"]
            abs_url = urljoin(url, href)
            try:
                link_resp = httpx.head(abs_url, timeout=5, follow_redirects=True)
                if link_resp.status_code >= 400:
                    result["inaccessible_links"].append({
                        "link_url": abs_url,
                        "status_code": link_resp.status_code
                    })
            except Exception:
                result["inaccessible_links"].append({
                    "link_url": abs_url,
                    "status_code": None
                })

        # Login form
        forms = soup.find_all("form")
        for form in forms:
            if form.find("input", {"type": "password"}):
                result["has_login_form"] = True
                break

    except Exception as e:
        result["error"] = str(e)
    return result
