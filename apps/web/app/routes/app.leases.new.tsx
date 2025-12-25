import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  FormControl,
  FormLabel,
  FormErrorMessage,
  Heading,
  HStack,
  Input,
  Select,
  Textarea,
  VStack,
  Grid,
  GridItem,
  Text,
  Alert,
  AlertIcon,
  Divider,
  NumberInput,
  NumberInputField,
  InputGroup,
  InputLeftAddon,
} from '@chakra-ui/react';
import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { useLoaderData, useActionData, Form, useNavigation, Link } from '@remix-run/react';
import { FiArrowLeft } from 'react-icons/fi';
import { requireAuth } from '~/lib/auth.server';
import { apiClient } from '~/lib/api.server';

interface Unit {
  id: string;
  name: string;
  propertyName: string;
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { token } = await requireAuth(request, context);
  const api = apiClient(context, token);

  // Load units for selection
  const unitsResponse = await api.get('/units?pageSize=100');
  if (!unitsResponse.ok) {
    throw new Error('Failed to load units');
  }

  const unitsData = await unitsResponse.json() as { units: Unit[] };

  return json({
    units: unitsData.units,
  });
}

export async function action({ request, context }: ActionFunctionArgs) {
  const { token } = await requireAuth(request, context);
  const api = apiClient(context, token);

  const formData = await request.formData();

  const leaseData = {
    unitId: formData.get('unitId'),
    guest: {
      email: formData.get('email'),
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      phone: formData.get('phone') || undefined,
    },
    startDate: formData.get('startDate'),
    endDate: formData.get('endDate'),
    leaseType: formData.get('leaseType'),
    monthlyRent: Math.round(parseFloat(formData.get('monthlyRent') as string) * 100),
    deposit: formData.get('deposit') ? Math.round(parseFloat(formData.get('deposit') as string) * 100) : undefined,
    currency: formData.get('currency') || 'GBP',
    rentDueDay: parseInt(formData.get('rentDueDay') as string) || 1,
    paymentFrequency: formData.get('paymentFrequency') || 'monthly',
    primaryOccupant: `${formData.get('firstName')} ${formData.get('lastName')}`,
    noticePeriodDays: parseInt(formData.get('noticePeriodDays') as string) || 30,
    breakClauseDate: formData.get('breakClauseDate') || undefined,
    specialTerms: formData.get('specialTerms') || undefined,
    internalNotes: formData.get('internalNotes') || undefined,
  };

  const response = await api.post('/leases', leaseData);

  if (!response.ok) {
    const error = await response.json() as { error?: string };
    return json({ error: error.error || 'Failed to create lease' }, { status: 400 });
  }

  const result = await response.json() as { lease: { id: string } };
  return redirect(`/app/leases/${result.lease.id}`);
}

export default function NewLease() {
  const { units } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  // Default dates
  const today = new Date();
  const defaultStart = today.toISOString().split('T')[0];
  const oneYearLater = new Date(today);
  oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
  const defaultEnd = oneYearLater.toISOString().split('T')[0];

  return (
    <Box maxW="4xl" mx="auto">
      <HStack mb={6}>
        <Button
          as={Link}
          to="/app/leases"
          variant="ghost"
          leftIcon={<FiArrowLeft />}
          size="sm"
        >
          Back to Leases
        </Button>
      </HStack>

      <Heading size="lg" mb={6}>
        New Lease
      </Heading>

      {actionData?.error && (
        <Alert status="error" mb={6}>
          <AlertIcon />
          {actionData.error}
        </Alert>
      )}

      <Form method="post">
        <VStack spacing={6} align="stretch">
          {/* Unit Selection */}
          <Card>
            <CardHeader>
              <Heading size="md">Property & Unit</Heading>
            </CardHeader>
            <CardBody>
              <FormControl isRequired>
                <FormLabel>Unit</FormLabel>
                <Select name="unitId" placeholder="Select a unit">
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name} - {unit.propertyName}
                    </option>
                  ))}
                </Select>
              </FormControl>
            </CardBody>
          </Card>

          {/* Tenant Information */}
          <Card>
            <CardHeader>
              <Heading size="md">Tenant Information</Heading>
            </CardHeader>
            <CardBody>
              <VStack spacing={4}>
                <Grid templateColumns="repeat(2, 1fr)" gap={4} w="full">
                  <GridItem>
                    <FormControl isRequired>
                      <FormLabel>First Name</FormLabel>
                      <Input name="firstName" />
                    </FormControl>
                  </GridItem>
                  <GridItem>
                    <FormControl isRequired>
                      <FormLabel>Last Name</FormLabel>
                      <Input name="lastName" />
                    </FormControl>
                  </GridItem>
                </Grid>

                <Grid templateColumns="repeat(2, 1fr)" gap={4} w="full">
                  <GridItem>
                    <FormControl isRequired>
                      <FormLabel>Email</FormLabel>
                      <Input name="email" type="email" />
                    </FormControl>
                  </GridItem>
                  <GridItem>
                    <FormControl>
                      <FormLabel>Phone</FormLabel>
                      <Input name="phone" type="tel" />
                    </FormControl>
                  </GridItem>
                </Grid>
              </VStack>
            </CardBody>
          </Card>

          {/* Lease Terms */}
          <Card>
            <CardHeader>
              <Heading size="md">Lease Terms</Heading>
            </CardHeader>
            <CardBody>
              <VStack spacing={4}>
                <Grid templateColumns="repeat(2, 1fr)" gap={4} w="full">
                  <GridItem>
                    <FormControl isRequired>
                      <FormLabel>Start Date</FormLabel>
                      <Input name="startDate" type="date" defaultValue={defaultStart} />
                    </FormControl>
                  </GridItem>
                  <GridItem>
                    <FormControl isRequired>
                      <FormLabel>End Date</FormLabel>
                      <Input name="endDate" type="date" defaultValue={defaultEnd} />
                    </FormControl>
                  </GridItem>
                </Grid>

                <Grid templateColumns="repeat(2, 1fr)" gap={4} w="full">
                  <GridItem>
                    <FormControl isRequired>
                      <FormLabel>Lease Type</FormLabel>
                      <Select name="leaseType" defaultValue="fixed">
                        <option value="fixed">Fixed Term</option>
                        <option value="month_to_month">Month-to-Month</option>
                        <option value="periodic">Periodic</option>
                      </Select>
                    </FormControl>
                  </GridItem>
                  <GridItem>
                    <FormControl isRequired>
                      <FormLabel>Notice Period (Days)</FormLabel>
                      <Input name="noticePeriodDays" type="number" defaultValue={30} />
                    </FormControl>
                  </GridItem>
                </Grid>

                <FormControl>
                  <FormLabel>Break Clause Date (Optional)</FormLabel>
                  <Input name="breakClauseDate" type="date" />
                  <Text fontSize="sm" color="gray.500" mt={1}>
                    Date when either party can terminate with notice
                  </Text>
                </FormControl>
              </VStack>
            </CardBody>
          </Card>

          {/* Financial Terms */}
          <Card>
            <CardHeader>
              <Heading size="md">Financial Terms</Heading>
            </CardHeader>
            <CardBody>
              <VStack spacing={4}>
                <Grid templateColumns="repeat(3, 1fr)" gap={4} w="full">
                  <GridItem>
                    <FormControl isRequired>
                      <FormLabel>Monthly Rent</FormLabel>
                      <InputGroup>
                        <InputLeftAddon>£</InputLeftAddon>
                        <Input name="monthlyRent" type="number" step="0.01" />
                      </InputGroup>
                    </FormControl>
                  </GridItem>
                  <GridItem>
                    <FormControl>
                      <FormLabel>Deposit</FormLabel>
                      <InputGroup>
                        <InputLeftAddon>£</InputLeftAddon>
                        <Input name="deposit" type="number" step="0.01" />
                      </InputGroup>
                    </FormControl>
                  </GridItem>
                  <GridItem>
                    <FormControl>
                      <FormLabel>Currency</FormLabel>
                      <Select name="currency" defaultValue="GBP">
                        <option value="GBP">GBP</option>
                        <option value="EUR">EUR</option>
                        <option value="USD">USD</option>
                      </Select>
                    </FormControl>
                  </GridItem>
                </Grid>

                <Grid templateColumns="repeat(2, 1fr)" gap={4} w="full">
                  <GridItem>
                    <FormControl isRequired>
                      <FormLabel>Rent Due Day</FormLabel>
                      <Select name="rentDueDay" defaultValue="1">
                        {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                          <option key={day} value={day}>
                            {day}{day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th'} of the month
                          </option>
                        ))}
                      </Select>
                    </FormControl>
                  </GridItem>
                  <GridItem>
                    <FormControl isRequired>
                      <FormLabel>Payment Frequency</FormLabel>
                      <Select name="paymentFrequency" defaultValue="monthly">
                        <option value="weekly">Weekly</option>
                        <option value="fortnightly">Fortnightly</option>
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                      </Select>
                    </FormControl>
                  </GridItem>
                </Grid>
              </VStack>
            </CardBody>
          </Card>

          {/* Additional Details */}
          <Card>
            <CardHeader>
              <Heading size="md">Additional Details</Heading>
            </CardHeader>
            <CardBody>
              <VStack spacing={4}>
                <FormControl>
                  <FormLabel>Special Terms</FormLabel>
                  <Textarea
                    name="specialTerms"
                    placeholder="Any special terms or conditions..."
                    rows={3}
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Internal Notes</FormLabel>
                  <Textarea
                    name="internalNotes"
                    placeholder="Notes for internal use only..."
                    rows={2}
                  />
                </FormControl>
              </VStack>
            </CardBody>
          </Card>

          {/* Submit */}
          <HStack justify="flex-end" spacing={4}>
            <Button as={Link} to="/app/leases" variant="ghost">
              Cancel
            </Button>
            <Button
              type="submit"
              colorScheme="brand"
              isLoading={isSubmitting}
            >
              Create Lease
            </Button>
          </HStack>
        </VStack>
      </Form>
    </Box>
  );
}
