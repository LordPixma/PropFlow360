import {
  Box,
  Heading,
  Card,
  CardBody,
  FormControl,
  FormLabel,
  FormErrorMessage,
  Input,
  Textarea,
  Select,
  Button,
  HStack,
  VStack,
  SimpleGrid,
  Divider,
  Alert,
  AlertIcon,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Icon,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
} from '@chakra-ui/react';
import { Form, Link, useActionData, useNavigation, useParams, useLoaderData } from '@remix-run/react';
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/cloudflare';
import { json, redirect } from '@remix-run/cloudflare';
import { FiChevronRight } from 'react-icons/fi';
import { createApiClient } from '~/lib/api.server';
import { getSession } from '~/lib/session.server';

interface Property {
  id: string;
  name: string;
}

interface LoaderData {
  property: Property | null;
  error?: string;
}

interface ActionData {
  errors?: Record<string, string>;
  error?: string;
}

export async function loader({ request, context, params }: LoaderFunctionArgs) {
  const session = await getSession(request, context);
  const accessToken = session.get('accessToken');

  if (!accessToken) {
    return json<LoaderData>({ property: null, error: 'Not authenticated' });
  }

  try {
    const api = createApiClient(context, accessToken);
    const result = await api.get<Property>(`/properties/${params.id}`);

    if (result.success && result.data) {
      return json<LoaderData>({ property: result.data });
    }

    return json<LoaderData>({ property: null, error: 'Property not found' });
  } catch {
    return json<LoaderData>({ property: null, error: 'Failed to load property' });
  }
}

export async function action({ request, context, params }: ActionFunctionArgs) {
  const session = await getSession(request, context);
  const accessToken = session.get('accessToken');

  if (!accessToken) {
    return json<ActionData>({ error: 'Not authenticated' }, { status: 401 });
  }

  const formData = await request.formData();

  const data = {
    propertyId: params.id,
    name: formData.get('name') as string,
    type: formData.get('type') as string,
    description: formData.get('description') as string || undefined,
    maxGuests: parseInt(formData.get('maxGuests') as string) || 2,
    bedrooms: parseInt(formData.get('bedrooms') as string) || 1,
    beds: parseInt(formData.get('beds') as string) || 1,
    bathrooms: parseFloat(formData.get('bathrooms') as string) || 1,
    sizeSqm: parseFloat(formData.get('sizeSqm') as string) || undefined,
    floor: parseInt(formData.get('floor') as string) || undefined,
  };

  // Basic validation
  const errors: Record<string, string> = {};
  if (!data.name || data.name.trim().length < 2) {
    errors.name = 'Unit name must be at least 2 characters';
  }
  if (!data.type) {
    errors.type = 'Unit type is required';
  }

  if (Object.keys(errors).length > 0) {
    return json<ActionData>({ errors }, { status: 400 });
  }

  try {
    const api = createApiClient(context, accessToken);
    const result = await api.post<{ id: string }>(`/properties/${params.id}/units`, data);

    if (result.success && result.data) {
      return redirect(`/app/units/${result.data.id}`);
    }

    return json<ActionData>({ error: result.error?.message || 'Failed to create unit' }, { status: 400 });
  } catch (error) {
    console.error('Error creating unit:', error);
    return json<ActionData>({ error: 'Failed to create unit' }, { status: 500 });
  }
}

export default function NewUnit() {
  const { id } = useParams();
  const { property, error: loaderError } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  if (loaderError || !property) {
    return (
      <Box>
        <Alert status="error">
          <AlertIcon />
          {loaderError || 'Property not found'}
        </Alert>
      </Box>
    );
  }

  return (
    <Box maxW="4xl">
      {/* Breadcrumb */}
      <Breadcrumb mb={4} separator={<Icon as={FiChevronRight} color="gray.400" />}>
        <BreadcrumbItem>
          <BreadcrumbLink as={Link} to="/app/properties">
            Properties
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbItem>
          <BreadcrumbLink as={Link} to={`/app/properties/${id}`}>
            {property.name}
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>
          <BreadcrumbLink>New Unit</BreadcrumbLink>
        </BreadcrumbItem>
      </Breadcrumb>

      <Heading size="lg" mb={6}>
        Add New Unit to {property.name}
      </Heading>

      {actionData?.error && (
        <Alert status="error" mb={6}>
          <AlertIcon />
          {actionData.error}
        </Alert>
      )}

      <Form method="post">
        <VStack spacing={6} align="stretch">
          {/* Basic Information */}
          <Card>
            <CardBody>
              <Heading size="md" mb={4}>
                Basic Information
              </Heading>
              <VStack spacing={4}>
                <FormControl isRequired isInvalid={!!actionData?.errors?.name}>
                  <FormLabel>Unit Name</FormLabel>
                  <Input name="name" placeholder="e.g., Unit 1A - Studio" />
                  {actionData?.errors?.name && (
                    <FormErrorMessage>{actionData.errors.name}</FormErrorMessage>
                  )}
                </FormControl>

                <FormControl isRequired isInvalid={!!actionData?.errors?.type}>
                  <FormLabel>Unit Type</FormLabel>
                  <Select name="type" placeholder="Select type">
                    <option value="room">Room</option>
                    <option value="apartment">Apartment</option>
                    <option value="studio">Studio</option>
                    <option value="office">Office</option>
                    <option value="entire_property">Entire Property</option>
                    <option value="suite">Suite</option>
                    <option value="villa">Villa</option>
                  </Select>
                  {actionData?.errors?.type && (
                    <FormErrorMessage>{actionData.errors.type}</FormErrorMessage>
                  )}
                </FormControl>

                <FormControl>
                  <FormLabel>Description</FormLabel>
                  <Textarea
                    name="description"
                    placeholder="Describe this unit..."
                    rows={4}
                  />
                </FormControl>
              </VStack>
            </CardBody>
          </Card>

          {/* Capacity & Size */}
          <Card>
            <CardBody>
              <Heading size="md" mb={4}>
                Capacity & Size
              </Heading>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <FormControl>
                  <FormLabel>Max Guests</FormLabel>
                  <NumberInput defaultValue={2} min={1} max={50}>
                    <NumberInputField name="maxGuests" />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                </FormControl>

                <FormControl>
                  <FormLabel>Bedrooms</FormLabel>
                  <NumberInput defaultValue={1} min={0} max={20}>
                    <NumberInputField name="bedrooms" />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                </FormControl>

                <FormControl>
                  <FormLabel>Beds</FormLabel>
                  <NumberInput defaultValue={1} min={1} max={50}>
                    <NumberInputField name="beds" />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                </FormControl>

                <FormControl>
                  <FormLabel>Bathrooms</FormLabel>
                  <NumberInput defaultValue={1} min={0} max={20} step={0.5}>
                    <NumberInputField name="bathrooms" />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                </FormControl>

                <FormControl>
                  <FormLabel>Size (m²)</FormLabel>
                  <NumberInput min={0}>
                    <NumberInputField name="sizeSqm" placeholder="e.g., 45" />
                  </NumberInput>
                </FormControl>

                <FormControl>
                  <FormLabel>Floor</FormLabel>
                  <NumberInput min={-5} max={200}>
                    <NumberInputField name="floor" placeholder="e.g., 1" />
                  </NumberInput>
                </FormControl>
              </SimpleGrid>
            </CardBody>
          </Card>

          <Divider />

          {/* Actions */}
          <HStack justify="flex-end" spacing={4}>
            <Button as={Link} to={`/app/properties/${id}`} variant="ghost">
              Cancel
            </Button>
            <Button type="submit" colorScheme="brand" isLoading={isSubmitting}>
              Create Unit
            </Button>
          </HStack>
        </VStack>
      </Form>
    </Box>
  );
}
