import {
  Box,
  Heading,
  Card,
  CardBody,
  FormControl,
  FormLabel,
  FormErrorMessage,
  Input,
  Select,
  Button,
  HStack,
  VStack,
  SimpleGrid,
  Divider,
  Alert,
  AlertIcon,
  Text,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Textarea,
} from '@chakra-ui/react';
import { Form, Link, useActionData, useNavigation, useLoaderData } from '@remix-run/react';
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/cloudflare';
import { json, redirect } from '@remix-run/cloudflare';
import { createApiClient } from '~/lib/api.server';
import { getSession } from '~/lib/session.server';

interface Unit {
  id: string;
  name: string;
  propertyId: string;
  propertyName: string;
}

interface LoaderData {
  units: Unit[];
  error?: string;
}

interface ActionData {
  errors?: Record<string, string>;
  error?: string;
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  const session = await getSession(request, context);
  const accessToken = session.get('accessToken');

  if (!accessToken) {
    return json<LoaderData>({ units: [], error: 'Not authenticated' });
  }

  try {
    const api = createApiClient(context, accessToken);
    const response = await api.get<Unit[]>('/units', { status: 'active', pageSize: '100' });

    return json<LoaderData>({
      units: response.data || [],
    });
  } catch (error) {
    return json<LoaderData>({ units: [], error: 'Failed to load units' });
  }
}

export async function action({ request, context }: ActionFunctionArgs) {
  const session = await getSession(request, context);
  const accessToken = session.get('accessToken');

  if (!accessToken) {
    return json<ActionData>({ error: 'Not authenticated' }, { status: 401 });
  }

  const formData = await request.formData();

  const data = {
    unitId: formData.get('unitId') as string,
    guest: {
      email: formData.get('guestEmail') as string,
      firstName: formData.get('guestFirstName') as string,
      lastName: formData.get('guestLastName') as string,
      phone: formData.get('guestPhone') as string || undefined,
    },
    checkInDate: formData.get('checkInDate') as string,
    checkOutDate: formData.get('checkOutDate') as string,
    adults: parseInt(formData.get('adults') as string) || 1,
    children: parseInt(formData.get('children') as string) || 0,
    infants: parseInt(formData.get('infants') as string) || 0,
    nightlyRate: Math.round(parseFloat(formData.get('nightlyRate') as string) * 100) || 0,
    cleaningFee: Math.round(parseFloat(formData.get('cleaningFee') as string) * 100) || 0,
    source: formData.get('source') as string || 'direct',
    guestNotes: formData.get('guestNotes') as string || undefined,
    internalNotes: formData.get('internalNotes') as string || undefined,
    specialRequests: formData.get('specialRequests') as string || undefined,
  };

  // Basic validation
  const errors: Record<string, string> = {};

  if (!data.unitId) {
    errors.unitId = 'Please select a unit';
  }
  if (!data.guest.email) {
    errors.guestEmail = 'Guest email is required';
  }
  if (!data.guest.firstName) {
    errors.guestFirstName = 'First name is required';
  }
  if (!data.guest.lastName) {
    errors.guestLastName = 'Last name is required';
  }
  if (!data.checkInDate) {
    errors.checkInDate = 'Check-in date is required';
  }
  if (!data.checkOutDate) {
    errors.checkOutDate = 'Check-out date is required';
  }
  if (data.checkOutDate && data.checkInDate && data.checkOutDate <= data.checkInDate) {
    errors.checkOutDate = 'Check-out must be after check-in';
  }

  if (Object.keys(errors).length > 0) {
    return json<ActionData>({ errors }, { status: 400 });
  }

  try {
    const api = createApiClient(context, accessToken);
    const result = await api.post<{ id: string }>('/bookings', data);

    if (result.success && result.data) {
      return redirect(`/app/bookings/${result.data.id}`);
    }

    return json<ActionData>({ error: result.error?.message || 'Failed to create booking' }, { status: 400 });
  } catch (error) {
    console.error('Error creating booking:', error);
    return json<ActionData>({ error: 'Failed to create booking' }, { status: 500 });
  }
}

export default function NewBooking() {
  const { units, error: loaderError } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  // Group units by property
  const unitsByProperty: Record<string, { propertyName: string; units: Unit[] }> = {};
  for (const unit of units) {
    if (!unitsByProperty[unit.propertyId]) {
      unitsByProperty[unit.propertyId] = { propertyName: unit.propertyName, units: [] };
    }
    unitsByProperty[unit.propertyId].units.push(unit);
  }

  return (
    <Box maxW="4xl">
      <Heading size="lg" mb={6}>
        New Booking
      </Heading>

      {(loaderError || actionData?.error) && (
        <Alert status="error" mb={6}>
          <AlertIcon />
          {loaderError || actionData?.error}
        </Alert>
      )}

      <Form method="post">
        <VStack spacing={6} align="stretch">
          {/* Unit Selection */}
          <Card>
            <CardBody>
              <Heading size="md" mb={4}>
                Unit
              </Heading>
              <FormControl isRequired isInvalid={!!actionData?.errors?.unitId}>
                <FormLabel>Select Unit</FormLabel>
                <Select name="unitId" placeholder="Choose a unit...">
                  {Object.entries(unitsByProperty).map(([propertyId, { propertyName, units: propertyUnits }]) => (
                    <optgroup key={propertyId} label={propertyName}>
                      {propertyUnits.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </Select>
                {actionData?.errors?.unitId && (
                  <FormErrorMessage>{actionData.errors.unitId}</FormErrorMessage>
                )}
              </FormControl>
            </CardBody>
          </Card>

          {/* Guest Information */}
          <Card>
            <CardBody>
              <Heading size="md" mb={4}>
                Guest Information
              </Heading>
              <VStack spacing={4}>
                <SimpleGrid columns={2} spacing={4} w="full">
                  <FormControl isRequired isInvalid={!!actionData?.errors?.guestFirstName}>
                    <FormLabel>First Name</FormLabel>
                    <Input name="guestFirstName" placeholder="John" />
                    {actionData?.errors?.guestFirstName && (
                      <FormErrorMessage>{actionData.errors.guestFirstName}</FormErrorMessage>
                    )}
                  </FormControl>

                  <FormControl isRequired isInvalid={!!actionData?.errors?.guestLastName}>
                    <FormLabel>Last Name</FormLabel>
                    <Input name="guestLastName" placeholder="Smith" />
                    {actionData?.errors?.guestLastName && (
                      <FormErrorMessage>{actionData.errors.guestLastName}</FormErrorMessage>
                    )}
                  </FormControl>
                </SimpleGrid>

                <SimpleGrid columns={2} spacing={4} w="full">
                  <FormControl isRequired isInvalid={!!actionData?.errors?.guestEmail}>
                    <FormLabel>Email</FormLabel>
                    <Input name="guestEmail" type="email" placeholder="john@example.com" />
                    {actionData?.errors?.guestEmail && (
                      <FormErrorMessage>{actionData.errors.guestEmail}</FormErrorMessage>
                    )}
                  </FormControl>

                  <FormControl>
                    <FormLabel>Phone</FormLabel>
                    <Input name="guestPhone" type="tel" placeholder="+44 7700 900000" />
                  </FormControl>
                </SimpleGrid>
              </VStack>
            </CardBody>
          </Card>

          {/* Dates and Guests */}
          <Card>
            <CardBody>
              <Heading size="md" mb={4}>
                Stay Details
              </Heading>
              <VStack spacing={4}>
                <SimpleGrid columns={2} spacing={4} w="full">
                  <FormControl isRequired isInvalid={!!actionData?.errors?.checkInDate}>
                    <FormLabel>Check-in Date</FormLabel>
                    <Input name="checkInDate" type="date" />
                    {actionData?.errors?.checkInDate && (
                      <FormErrorMessage>{actionData.errors.checkInDate}</FormErrorMessage>
                    )}
                  </FormControl>

                  <FormControl isRequired isInvalid={!!actionData?.errors?.checkOutDate}>
                    <FormLabel>Check-out Date</FormLabel>
                    <Input name="checkOutDate" type="date" />
                    {actionData?.errors?.checkOutDate && (
                      <FormErrorMessage>{actionData.errors.checkOutDate}</FormErrorMessage>
                    )}
                  </FormControl>
                </SimpleGrid>

                <SimpleGrid columns={3} spacing={4} w="full">
                  <FormControl>
                    <FormLabel>Adults</FormLabel>
                    <NumberInput defaultValue={1} min={1} max={20}>
                      <NumberInputField name="adults" />
                      <NumberInputStepper>
                        <NumberIncrementStepper />
                        <NumberDecrementStepper />
                      </NumberInputStepper>
                    </NumberInput>
                  </FormControl>

                  <FormControl>
                    <FormLabel>Children</FormLabel>
                    <NumberInput defaultValue={0} min={0} max={20}>
                      <NumberInputField name="children" />
                      <NumberInputStepper>
                        <NumberIncrementStepper />
                        <NumberDecrementStepper />
                      </NumberInputStepper>
                    </NumberInput>
                  </FormControl>

                  <FormControl>
                    <FormLabel>Infants</FormLabel>
                    <NumberInput defaultValue={0} min={0} max={10}>
                      <NumberInputField name="infants" />
                      <NumberInputStepper>
                        <NumberIncrementStepper />
                        <NumberDecrementStepper />
                      </NumberInputStepper>
                    </NumberInput>
                  </FormControl>
                </SimpleGrid>
              </VStack>
            </CardBody>
          </Card>

          {/* Pricing */}
          <Card>
            <CardBody>
              <Heading size="md" mb={4}>
                Pricing
              </Heading>
              <SimpleGrid columns={3} spacing={4}>
                <FormControl>
                  <FormLabel>Nightly Rate (£)</FormLabel>
                  <NumberInput min={0} precision={2}>
                    <NumberInputField name="nightlyRate" placeholder="0.00" />
                  </NumberInput>
                </FormControl>

                <FormControl>
                  <FormLabel>Cleaning Fee (£)</FormLabel>
                  <NumberInput min={0} precision={2}>
                    <NumberInputField name="cleaningFee" placeholder="0.00" />
                  </NumberInput>
                </FormControl>

                <FormControl>
                  <FormLabel>Source</FormLabel>
                  <Select name="source" defaultValue="direct">
                    <option value="direct">Direct</option>
                    <option value="airbnb">Airbnb</option>
                    <option value="booking_com">Booking.com</option>
                    <option value="vrbo">VRBO</option>
                    <option value="expedia">Expedia</option>
                    <option value="other">Other</option>
                  </Select>
                </FormControl>
              </SimpleGrid>
            </CardBody>
          </Card>

          {/* Notes */}
          <Card>
            <CardBody>
              <Heading size="md" mb={4}>
                Notes
              </Heading>
              <VStack spacing={4}>
                <FormControl>
                  <FormLabel>Special Requests</FormLabel>
                  <Textarea
                    name="specialRequests"
                    placeholder="Any special requests from the guest..."
                    rows={2}
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Internal Notes</FormLabel>
                  <Textarea
                    name="internalNotes"
                    placeholder="Notes for staff (not visible to guest)..."
                    rows={2}
                  />
                </FormControl>
              </VStack>
            </CardBody>
          </Card>

          <Divider />

          {/* Actions */}
          <HStack justify="flex-end" spacing={4}>
            <Button as={Link} to="/app/bookings" variant="ghost">
              Cancel
            </Button>
            <Button type="submit" colorScheme="brand" isLoading={isSubmitting}>
              Create Booking
            </Button>
          </HStack>
        </VStack>
      </Form>
    </Box>
  );
}
