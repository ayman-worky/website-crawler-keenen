import React from "react"
import { Box, Button, Input, Text } from "@chakra-ui/react"
import { useForm } from "react-hook-form"

export type UrlFormValues = {
  url: string
}

export interface UrlFormProps {
  onSubmit: (values: UrlFormValues) => void
  isLoading?: boolean
}

export function UrlForm({ onSubmit, isLoading }: UrlFormProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<UrlFormValues>()

  return (
    <Box as="form" onSubmit={handleSubmit(onSubmit)} display="flex" flexDirection="column" gap={2}>
      <Input
        id="url"
        placeholder="https://example.com"
        {...register("url", { required: "URL is required" })}
        _invalid={errors.url ? { borderColor: 'red.500' } : {}}
      />
      {errors.url && (
        <Text color="red.500" fontSize="sm">{errors.url.message}</Text>
      )}
      <Button mt={2} colorScheme="blue" type="submit" loading={isLoading}>
        Submit
      </Button>
    </Box>
  )
} 