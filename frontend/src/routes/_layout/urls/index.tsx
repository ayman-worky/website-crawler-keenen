import React from "react"
import { Box, Container, Heading, VStack } from "@chakra-ui/react"
import { createFileRoute, Outlet } from "@tanstack/react-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { UrlForm, UrlFormValues } from "@/components/Urls/UrlForm"
import { UrlList } from "@/components/Urls/UrlList"
import { UrlsService, type CrawledURL } from "@/client"
import useCustomToast from "@/hooks/useCustomToast"
import { useState } from "react"
import { Input, HStack, Spinner, Text, Button, Portal } from "@chakra-ui/react"
import { Select, createListCollection } from "@chakra-ui/react"

export const Route = createFileRoute("/_layout/urls/")({
  component: UrlsDashboard,
})

function UrlsDashboard() {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  // New state for controls
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [filterStatus, setFilterStatus] = useState("")
  const [searchTerm, setSearchTerm] = useState("")

  // Fetch URLs with new params (only pass supported params)
  const { data: urls = [], isLoading } = useQuery({
    queryKey: ["urls", { page, pageSize, filterStatus, searchTerm }],
    queryFn: () =>
      UrlsService.listUrls({
        skip: (page - 1) * pageSize,
        limit: pageSize,
        status: filterStatus || undefined,
        search: searchTerm || undefined,
        // Uncomment below if your OpenAPI client supports these params:
        // status: filterStatus || undefined,
        // search: searchTerm || undefined,
      }),
  })

  // Add URL
  const addUrlMutation = useMutation({
    mutationFn: (values: UrlFormValues) =>
      UrlsService.addUrl({ url: values.url }),
    onSuccess: () => {
      showSuccessToast("URL added!")
      queryClient.invalidateQueries({ queryKey: ["urls"] })
    },
    onError: (err: any) => {
      showErrorToast(err?.body?.detail || "Failed to add URL")
    },
  })

  // Start/Stop/Delete/Reanalyze Mutations
  const startMutation = useMutation({
    mutationFn: (id: number) => UrlsService.startCrawl({ id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["urls"] }),
  })
  const stopMutation = useMutation({
    mutationFn: (id: number) => UrlsService.stopCrawl({ id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["urls"] }),
  })
  const deleteMutation = useMutation({
    mutationFn: (id: number) => UrlsService.bulkDeleteUrls({ requestBody: [id] }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["urls"] }),
  })
  const reanalyzeMutation = useMutation({
    mutationFn: (id: number) => UrlsService.bulkReanalyzeUrls({ requestBody: [id] }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["urls"] }),
  })

  // Handlers
  const handleAddUrl = (values: UrlFormValues) => addUrlMutation.mutate(values)
  const handleStart = (id: number) => startMutation.mutate(id)
  const handleStop = (id: number) => stopMutation.mutate(id)
  const handleDelete = (id: number) => deleteMutation.mutate(id)
  const handleReanalyze = (id: number) => reanalyzeMutation.mutate(id)

  // Map backend data to UrlList format if needed
  const urlListData = (urls as CrawledURL[]).map((u) => ({
    id: u.id!,
    url: u.url,
    status: u.status || "",
  }))

  // Pagination helpers
  const total = (urls as any)?.count || 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const statusOptions = createListCollection({
    items: [
      { label: "All", value: "" },
      { label: "Queued", value: "queued" },
      { label: "Running", value: "running" },
      { label: "Done", value: "done" },
      { label: "Error", value: "error" },
    ],
  })

  return (
    <Container maxW="4xl" py={8}>
      <VStack gap={8} alignItems="stretch">
        <Heading as="h1" size="lg">
          Website Crawler Dashboard
        </Heading>
        <Box>
          <UrlForm onSubmit={handleAddUrl} isLoading={addUrlMutation.isPending} />
        </Box>
        {/* Controls */}
        <HStack mb={4}>
          <Input
            placeholder="Search URLs"
            value={searchTerm}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setSearchTerm(e.target.value); setPage(1); }}
          />
          <Select.Root
            value={filterStatus}
            onValueChange={item => {
              const selected = Array.isArray(item) ? item[0]?.value : item?.value ?? "";
              setFilterStatus(selected);
              setPage(1);
            }}
            collection={statusOptions}
          >
            <Select.HiddenSelect />
            <Select.Trigger>
              <Select.ValueText placeholder="Filter by status" />
            </Select.Trigger>
            <Portal>
              <Select.Positioner>
                <Select.Content>
                  {statusOptions.items.map((item) => (
                    <Select.Item item={item} key={item.value}>
                      {item.label}
                      <Select.ItemIndicator />
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Positioner>
            </Portal>
          </Select.Root>
        </HStack>
        <Box>
          {isLoading ? (
            <Spinner />
          ) : (
            <UrlList
              urls={urlListData}
              onStart={handleStart}
              onStop={handleStop}
              onDelete={handleDelete}
              onReanalyze={handleReanalyze}
            />
          )}
        </Box>
        {/* Pagination controls */}
        <HStack mt={4} justify="flex-end">
          <Button onClick={() => setPage(page - 1)} disabled={page === 1}>Prev</Button>
          <Text>
            Page {page} of {totalPages}
          </Text>
          <Button onClick={() => setPage(page + 1)} disabled={page >= totalPages}>Next</Button>
        </HStack>
      </VStack>
    </Container>
  )
}