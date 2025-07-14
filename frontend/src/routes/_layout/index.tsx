import { Box, Container, Text, Heading, Card, CardBody, CardHeader, Flex } from "@chakra-ui/react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import useAuth from "@/hooks/useAuth"
import { useQuery } from "@tanstack/react-query"
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from "recharts"
import { UrlsService } from "@/client"

const STATUS_COLORS: Record<string, string> = {
  queued: "#8884d8",
  running: "#82ca9d",
  done: "#0088FE",
  error: "#FF8042",
};

export const Route = createFileRoute("/_layout/")({
  component: Dashboard,
})

function Dashboard() {
  const { user: currentUser } = useAuth()
  const navigate = useNavigate()

  // Fetch URL stats using the generated client
  const { data: urlStats, isLoading } = useQuery({
    queryKey: ["url-stats"],
    queryFn: () => UrlsService.urlStats(),
  })

  // Prepare data for PieChart
  const pieData = urlStats && urlStats.by_status
    ? Object.entries(urlStats.by_status).map(([status, value]) => ({
        name: status,
        value,
      }))
    : []

  return (
    <Container maxW="full">
      <Box pt={12} m={4}>
        <Text fontSize="2xl" truncate maxW="sm">
          Hi, {currentUser?.full_name || currentUser?.email} 👋🏼
        </Text>
        <Text>Welcome back, nice to see you again!</Text>
      </Box>
      <Flex gap={8} flexWrap="wrap" mt={8}>
        <Box
  w="350px"
  p={4}
  borderWidth="1px"
  borderRadius="lg"
  boxShadow="md"
  cursor="pointer"
  _hover={{ boxShadow: "lg", transform: "scale(1.03)" }}
  onClick={() => navigate({ to: "/urls" })}
>
  <Box mb={2}>
    <Heading size="md">URLs by Status</Heading>
  </Box>

            {isLoading ? (
              <Text>Loading...</Text>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    label
                  >
                    {pieData.map((entry, idx) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || "#ccc"} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
            <Text mt={4} fontWeight="bold" fontSize="lg" textAlign="center">
              Total URLs: {urlStats?.total ?? 0}
            </Text>
        </Box>

      </Flex>
    </Container>
  )
}