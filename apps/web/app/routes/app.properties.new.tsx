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
} from '@chakra-ui/react';
import { Form, Link, useActionData, useNavigation } from '@remix-run/react';
import type { ActionFunctionArgs } from '@remix-run/cloudflare';
import { json, redirect } from '@remix-run/cloudflare';
import { createApiClient } from '~/lib/api.server';
import { getSession } from '~/lib/session.server';

interface ActionData {
  errors?: Record<string, string>;
  error?: string;
}

export async function action({ request, context }: ActionFunctionArgs) {
  const session = await getSession(request, context);
  const accessToken = session.get('accessToken');

  if (!accessToken) {
    return json<ActionData>({ error: 'Not authenticated' }, { status: 401 });
  }

  const formData = await request.formData();

  const data = {
    name: formData.get('name') as string,
    type: formData.get('type') as string,
    description: formData.get('description') as string || undefined,
    addressLine1: formData.get('addressLine1') as string || undefined,
    addressLine2: formData.get('addressLine2') as string || undefined,
    city: formData.get('city') as string || undefined,
    state: formData.get('state') as string || undefined,
    postalCode: formData.get('postalCode') as string || undefined,
    country: formData.get('country') as string || undefined,
    checkInTime: formData.get('checkInTime') as string || undefined,
    checkOutTime: formData.get('checkOutTime') as string || undefined,
  };

  // Basic validation
  const errors: Record<string, string> = {};
  if (!data.name || data.name.trim().length < 2) {
    errors.name = 'Property name must be at least 2 characters';
  }
  if (!data.type) {
    errors.type = 'Property type is required';
  }

  if (Object.keys(errors).length > 0) {
    return json<ActionData>({ errors }, { status: 400 });
  }

  try {
    const api = createApiClient(context, accessToken);
    const result = await api.post<{ id: string }>('/properties', data);

    if (result.success && result.data) {
      return redirect(`/app/properties/${result.data.id}`);
    }

    return json<ActionData>({ error: result.error?.message || 'Failed to create property' }, { status: 400 });
  } catch (error) {
    console.error('Error creating property:', error);
    return json<ActionData>({ error: 'Failed to create property' }, { status: 500 });
  }
}

export default function NewProperty() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  return (
    <Box maxW="4xl">
      <Heading size="lg" mb={6}>
        Add New Property
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
                  <FormLabel>Property Name</FormLabel>
                  <Input name="name" placeholder="e.g., Seaside Apartments" />
                  {actionData?.errors?.name && (
                    <FormErrorMessage>{actionData.errors.name}</FormErrorMessage>
                  )}
                </FormControl>

                <FormControl isRequired isInvalid={!!actionData?.errors?.type}>
                  <FormLabel>Property Type</FormLabel>
                  <Select name="type" placeholder="Select type">
                    <option value="residential">Residential</option>
                    <option value="commercial">Commercial</option>
                    <option value="studio">Studio</option>
                    <option value="mixed">Mixed Use</option>
                    <option value="holiday_let">Holiday Let</option>
                  </Select>
                  {actionData?.errors?.type && (
                    <FormErrorMessage>{actionData.errors.type}</FormErrorMessage>
                  )}
                </FormControl>

                <FormControl>
                  <FormLabel>Description</FormLabel>
                  <Textarea
                    name="description"
                    placeholder="Describe your property..."
                    rows={4}
                  />
                </FormControl>
              </VStack>
            </CardBody>
          </Card>

          {/* Address */}
          <Card>
            <CardBody>
              <Heading size="md" mb={4}>
                Address
              </Heading>
              <VStack spacing={4}>
                <FormControl>
                  <FormLabel>Address Line 1</FormLabel>
                  <Input name="addressLine1" placeholder="Street address" />
                </FormControl>

                <FormControl>
                  <FormLabel>Address Line 2</FormLabel>
                  <Input name="addressLine2" placeholder="Apartment, suite, etc." />
                </FormControl>

                <SimpleGrid columns={2} spacing={4} w="full">
                  <FormControl>
                    <FormLabel>City</FormLabel>
                    <Input name="city" placeholder="City" />
                  </FormControl>

                  <FormControl>
                    <FormLabel>State/County</FormLabel>
                    <Input name="state" placeholder="State/County" />
                  </FormControl>
                </SimpleGrid>

                <SimpleGrid columns={2} spacing={4} w="full">
                  <FormControl>
                    <FormLabel>Postal Code</FormLabel>
                    <Input name="postalCode" placeholder="Postal code" />
                  </FormControl>

                  <FormControl>
                    <FormLabel>Country</FormLabel>
                    <Select name="country" defaultValue="GB">
                      <option value="GB">United Kingdom</option>
                      <option value="US">United States</option>
                      <option value="FR">France</option>
                      <option value="ES">Spain</option>
                      <option value="DE">Germany</option>
                    </Select>
                  </FormControl>
                </SimpleGrid>
              </VStack>
            </CardBody>
          </Card>

          {/* Settings */}
          <Card>
            <CardBody>
              <Heading size="md" mb={4}>
                Default Settings
              </Heading>
              <SimpleGrid columns={2} spacing={4}>
                <FormControl>
                  <FormLabel>Check-in Time</FormLabel>
                  <Input name="checkInTime" type="time" defaultValue="15:00" />
                </FormControl>

                <FormControl>
                  <FormLabel>Check-out Time</FormLabel>
                  <Input name="checkOutTime" type="time" defaultValue="11:00" />
                </FormControl>
              </SimpleGrid>
            </CardBody>
          </Card>

          <Divider />

          {/* Actions */}
          <HStack justify="flex-end" spacing={4}>
            <Button as={Link} to="/app/properties" variant="ghost">
              Cancel
            </Button>
            <Button type="submit" colorScheme="brand" isLoading={isSubmitting}>
              Create Property
            </Button>
          </HStack>
        </VStack>
      </Form>
    </Box>
  );
}
