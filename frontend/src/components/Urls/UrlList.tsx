import React from "react"
import { Box, Button, Table, Group } from "@chakra-ui/react"
import { Link } from "@tanstack/react-router"
import { FiEye, FiPlay, FiStopCircle, FiTrash2, FiRefreshCw } from "react-icons/fi"
import { Tooltip } from "@/components/ui/tooltip"
import { IconButton } from "@chakra-ui/react"

export interface Url {
  id: number
  url: string
  status: string
}

export interface UrlListProps {
  urls: Url[]
  onStart: (id: number) => void
  onStop: (id: number) => void
  onDelete: (id: number) => void
  onReanalyze: (id: number) => void
}

export function UrlList({ urls, onStart, onStop, onDelete, onReanalyze }: UrlListProps) {
  return (
    <Box overflowX="auto">
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeader>URL</Table.ColumnHeader>
            <Table.ColumnHeader>Status</Table.ColumnHeader>
            <Table.ColumnHeader>Actions</Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {urls.map((url) => (
            <Table.Row key={url.id}>
              <Table.Cell>{url.url}</Table.Cell>
              <Table.Cell>{url.status}</Table.Cell>
              <Table.Cell>
                 <Group>
                 <Tooltip content="View Details">
                  <Link to={`/urls/${url.id}`} style={{ textDecoration: "none" }}>
                  <IconButton
                    size="sm"
                    mr={1}
                    colorScheme="teal"
                    variant="outline"
                    aria-label="View Details"
                    aria-label="view_details">
                    <FiEye />
                  </IconButton>
                  </Link>
                </Tooltip>

                <Tooltip content="Start">
                 <IconButton
                    size="sm"
                    mr={1}
                    colorScheme="teal"
                    variant="outline"
                    aria-label="View Details"
                    onClick={() => onStart(url.id)}
                    aria-label="start">
                    <FiPlay />
                  </IconButton>
                </Tooltip>

                 <Tooltip content="Stop">
                 <IconButton
                    size="sm"
                    mr={1}
                    colorScheme="teal"
                    variant="outline"
                    aria-label="Stop"
                    onClick={() => onStop(url.id)}
                    aria-label="Stop">
                    <FiStopCircle />
                  </IconButton>
                </Tooltip>

                <Tooltip content="Delete">
                 <IconButton
                    size="sm"
                    mr={1}
                    colorScheme="teal"
                    variant="outline"
                    aria-label="Delete"
                    onClick={() => onDelete(url.id)}
                    aria-label="Delete">
                    <FiTrash2 />
                  </IconButton>
                </Tooltip>

                   <Tooltip content="Reanalyze">
                 <IconButton
                    size="sm"
                    mr={1}
                    colorScheme="teal"
                    variant="outline"
                    aria-label="Reanalyze"
                    onClick={() => onReanalyze(url.id)}
                    aria-label="Reanalyze">
                    <FiRefreshCw />
                  </IconButton>
                </Tooltip>
                </Group>





              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </Box>
  )
}