import React from "react"
import { Box, Container, Heading, Spinner, Text, VStack, Table } from "@chakra-ui/react"
import { createFileRoute, useParams } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { UrlsService } from "@/client"
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from "recharts"

const COLORS = ["#3182ce", "#38a169"]

export const Route = createFileRoute("/_layout/urls/$id")({
  component: UrlDetails,
})

function UrlDetails() {
  //const { id } = useParams("/_layout/urls/$id")
  const { id } = useParams({ from: "/_layout/urls/$id" });
  const urlId = Number(id)

  const { data, isLoading, error } = useQuery({
    queryKey: ["url-analysis", urlId],

    queryFn: () => UrlsService.getUrlAnalysis({ id: urlId }),
    enabled: !!urlId,
  })

  if (isLoading) {
    return <Spinner />
  }
  if (error) {
    return <Text color="red.500">Failed to load analysis.</Text>
  }
  if (!data) {
    return <Text>No analysis found.</Text>
  }

  // Prepare chart data
  const chartData = [
    { name: "Internal Links", value: data.internal_links_count },
    { name: "External Links", value: data.external_links_count },
  ]

  // Broken links (if available)
  const brokenLinks = (data as any).broken_links || []

  return (
    <Container maxW="2xl" py={8}>
      <VStack gap={4} alignItems="stretch">
        <Heading as="h2" size="md">URL Analysis Details</Heading>
        <Box>
          <Text><b>Title:</b> {data.title || "-"}</Text>
          <Text><b>HTML Version:</b> {data.html_version || "-"}</Text>
          <Text><b>H1 Count:</b> {data.h1_count}</Text>
          <Text><b>H2 Count:</b> {data.h2_count}</Text>
          <Text><b>H3 Count:</b> {data.h3_count}</Text>
          <Text><b>H4 Count:</b> {data.h4_count}</Text>
          <Text><b>H5 Count:</b> {data.h5_count}</Text>
          <Text><b>H6 Count:</b> {data.h6_count}</Text>
          <Text><b>Internal Links:</b> {data.internal_links_count}</Text>
          <Text><b>External Links:</b> {data.external_links_count}</Text>
          <Text><b>Inaccessible Links:</b> {data.inaccessible_links_count}</Text>
          <Text><b>Has Login Form:</b> {data.has_login_form ? "Yes" : "No"}</Text>
        </Box>
        <Box>
          <Heading as="h3" size="sm" mb={2}>Internal vs. External Links</Heading>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label
              >
                {chartData.map((entry, idx) => (
                  <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Box>
        {brokenLinks.length > 0 && (
          <Box>
            <Heading as="h3" size="sm" mb={2}>Broken Links</Heading>
            <Table.Root>
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>URL</Table.ColumnHeader>
                  <Table.ColumnHeader>Status Code</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {brokenLinks.map((link: any) => (
                  <Table.Row key={link.link_url}>
                    <Table.Cell>{link.link_url}</Table.Cell>
                    <Table.Cell>{link.status_code}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Box>
        )}
      </VStack>
    </Container>
  )
}