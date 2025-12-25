import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Heading,
  HStack,
  VStack,
  Text,
  Badge,
  Grid,
  GridItem,
  Divider,
  Alert,
  AlertIcon,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  useDisclosure,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Flex,
  Spacer,
} from '@chakra-ui/react';
import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { useLoaderData, useActionData, Form, useNavigation, Link, useSearchParams } from '@remix-run/react';
import { useEffect } from 'react';
import { FiArrowLeft, FiEdit, FiPlay, FiXCircle } from 'react-icons/fi';
import { requireAuth } from '~/lib/auth.server';
import { apiClient } from '~/lib/api.server';

interface RentScheduleItem {
  id: string;
  dueDate: string;
  amount: number;
  status: string;
  paidDate: string | null;
}

interface Lease {
  id: string;
  unitId: string;
  unitName: string;
  propertyId: string;
  propertyName: string;
  guestId: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string | null;
  status: string;
  leaseType: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  deposit: number | null;
  depositPaid: boolean;
  currency: string;
  rentDueDay: number;
  paymentFrequency: string;
  primaryOccupant: string;
  additionalOccupants: string[] | null;
  noticePeriodDays: number;
  breakClauseDate: string | null;
  specialTerms: string | null;
  internalNotes: string | null;
  terminatedAt: string | null;
  terminationReason: string | null;
  createdAt: string;
  updatedAt: string;
  rentSchedule: RentScheduleItem[];
}

export async function loader({ request, params, context }: LoaderFunctionArgs) {
  const { token } = await requireAuth(request, context);
  const api = apiClient(context, token);

  const response = await api.get(`/leases/${params.id}`);

  if (!response.ok) {
    throw new Response('Lease not found', { status: 404 });
  }

  const data = await response.json() as { lease: Lease };

  return json({ lease: data.lease });
}

export async function action({ request, params, context }: ActionFunctionArgs) {
  const { token } = await requireAuth(request, context);
  const api = apiClient(context, token);

  const formData = await request.formData();
  const intent = formData.get('intent');

  switch (intent) {
    case 'activate': {
      const response = await api.post(`/leases/${params.id}/activate`);
      if (!response.ok) {
        const error = await response.json() as { error?: string };
        return json({ error: error.error || 'Failed to activate lease' }, { status: 400 });
      }
      return json({ success: true });
    }

    case 'terminate': {
      const response = await api.post(`/leases/${params.id}/terminate`, {
        leaseId: params.id,
        reason: formData.get('reason'),
        terminationDate: formData.get('terminationDate'),
      });
      if (!response.ok) {
        const error = await response.json() as { error?: string };
        return json({ error: error.error || 'Failed to terminate lease' }, { status: 400 });
      }
      return json({ success: true });
    }

    default:
      return json({ error: 'Invalid action' }, { status: 400 });
  }
}

const statusColors: Record<string, string> = {
  draft: 'gray',
  pending_signature: 'yellow',
  active: 'green',
  expired: 'orange',
  terminated: 'red',
  renewed: 'blue',
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  pending_signature: 'Pending Signature',
  active: 'Active',
  expired: 'Expired',
  terminated: 'Terminated',
  renewed: 'Renewed',
};

const leaseTypeLabels: Record<string, string> = {
  fixed: 'Fixed Term',
  month_to_month: 'Month-to-Month',
  periodic: 'Periodic',
};

const paymentFrequencyLabels: Record<string, string> = {
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
};

const rentStatusColors: Record<string, string> = {
  pending: 'gray',
  paid: 'green',
  overdue: 'red',
  partial: 'yellow',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
  }).format(amount / 100);
}

function getDaySuffix(day: number): string {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

export default function LeaseDetail() {
  const { lease } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';
  const [searchParams, setSearchParams] = useSearchParams();

  const terminateModal = useDisclosure();

  // Open terminate modal if action=terminate in URL
  useEffect(() => {
    if (searchParams.get('action') === 'terminate') {
      terminateModal.onOpen();
      setSearchParams({});
    }
  }, [searchParams, terminateModal, setSearchParams]);

  const canActivate = lease.status === 'draft' || lease.status === 'pending_signature';
  const canTerminate = lease.status === 'active';

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

      {actionData?.error && (
        <Alert status="error" mb={6}>
          <AlertIcon />
          {actionData.error}
        </Alert>
      )}

      {actionData?.success && (
        <Alert status="success" mb={6}>
          <AlertIcon />
          Lease updated successfully
        </Alert>
      )}

      {/* Header */}
      <Flex mb={6} align="center">
        <Box>
          <HStack>
            <Heading size="lg">{lease.unitName}</Heading>
            <Badge colorScheme={statusColors[lease.status]} fontSize="md" px={3} py={1}>
              {statusLabels[lease.status]}
            </Badge>
          </HStack>
          <Text color="gray.600">{lease.propertyName}</Text>
        </Box>
        <Spacer />
        <HStack>
          {canActivate && (
            <Form method="post">
              <input type="hidden" name="intent" value="activate" />
              <Button
                type="submit"
                leftIcon={<FiPlay />}
                colorScheme="green"
                isLoading={isSubmitting}
              >
                Activate Lease
              </Button>
            </Form>
          )}
          {canTerminate && (
            <Button
              leftIcon={<FiXCircle />}
              colorScheme="red"
              variant="outline"
              onClick={terminateModal.onOpen}
            >
              Terminate
            </Button>
          )}
          <Button
            as={Link}
            to={`/app/leases/${lease.id}/edit`}
            leftIcon={<FiEdit />}
            variant="outline"
          >
            Edit
          </Button>
        </HStack>
      </Flex>

      <Grid templateColumns="repeat(3, 1fr)" gap={6}>
        {/* Left Column - Lease Details */}
        <GridItem colSpan={2}>
          <VStack spacing={6} align="stretch">
            {/* Tenant Info */}
            <Card>
              <CardHeader>
                <Heading size="md">Tenant Information</Heading>
              </CardHeader>
              <CardBody>
                <Grid templateColumns="repeat(2, 1fr)" gap={4}>
                  <Box>
                    <Text fontSize="sm" color="gray.500">Primary Occupant</Text>
                    <Text fontWeight="medium">{lease.primaryOccupant}</Text>
                  </Box>
                  <Box>
                    <Text fontSize="sm" color="gray.500">Email</Text>
                    <Text>{lease.guestEmail}</Text>
                  </Box>
                  <Box>
                    <Text fontSize="sm" color="gray.500">Phone</Text>
                    <Text>{lease.guestPhone || 'Not provided'}</Text>
                  </Box>
                  {lease.additionalOccupants && lease.additionalOccupants.length > 0 && (
                    <Box>
                      <Text fontSize="sm" color="gray.500">Additional Occupants</Text>
                      <Text>{lease.additionalOccupants.join(', ')}</Text>
                    </Box>
                  )}
                </Grid>
              </CardBody>
            </Card>

            {/* Lease Terms */}
            <Card>
              <CardHeader>
                <Heading size="md">Lease Terms</Heading>
              </CardHeader>
              <CardBody>
                <Grid templateColumns="repeat(2, 1fr)" gap={4}>
                  <Box>
                    <Text fontSize="sm" color="gray.500">Lease Type</Text>
                    <Text fontWeight="medium">{leaseTypeLabels[lease.leaseType]}</Text>
                  </Box>
                  <Box>
                    <Text fontSize="sm" color="gray.500">Term</Text>
                    <Text>
                      {formatDate(lease.startDate)} - {formatDate(lease.endDate)}
                    </Text>
                  </Box>
                  <Box>
                    <Text fontSize="sm" color="gray.500">Notice Period</Text>
                    <Text>{lease.noticePeriodDays} days</Text>
                  </Box>
                  {lease.breakClauseDate && (
                    <Box>
                      <Text fontSize="sm" color="gray.500">Break Clause Date</Text>
                      <Text>{formatDate(lease.breakClauseDate)}</Text>
                    </Box>
                  )}
                </Grid>

                {lease.specialTerms && (
                  <>
                    <Divider my={4} />
                    <Box>
                      <Text fontSize="sm" color="gray.500" mb={1}>Special Terms</Text>
                      <Text whiteSpace="pre-wrap">{lease.specialTerms}</Text>
                    </Box>
                  </>
                )}
              </CardBody>
            </Card>

            {/* Rent Schedule */}
            <Card>
              <CardHeader>
                <Heading size="md">Rent Schedule</Heading>
              </CardHeader>
              <CardBody p={0}>
                {lease.rentSchedule.length === 0 ? (
                  <Box p={4}>
                    <Text color="gray.500">No rent schedule generated yet</Text>
                  </Box>
                ) : (
                  <Table size="sm">
                    <Thead>
                      <Tr>
                        <Th>Due Date</Th>
                        <Th>Amount</Th>
                        <Th>Status</Th>
                        <Th>Paid Date</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {lease.rentSchedule.slice(0, 12).map((item) => (
                        <Tr key={item.id}>
                          <Td>{formatDate(item.dueDate)}</Td>
                          <Td>{formatCurrency(item.amount, lease.currency)}</Td>
                          <Td>
                            <Badge colorScheme={rentStatusColors[item.status] || 'gray'}>
                              {item.status}
                            </Badge>
                          </Td>
                          <Td>{item.paidDate ? formatDate(item.paidDate) : '-'}</Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                )}
                {lease.rentSchedule.length > 12 && (
                  <Box p={4} borderTopWidth="1px">
                    <Text fontSize="sm" color="gray.500">
                      Showing 12 of {lease.rentSchedule.length} scheduled payments
                    </Text>
                  </Box>
                )}
              </CardBody>
            </Card>

            {/* Internal Notes */}
            {lease.internalNotes && (
              <Card>
                <CardHeader>
                  <Heading size="md">Internal Notes</Heading>
                </CardHeader>
                <CardBody>
                  <Text whiteSpace="pre-wrap">{lease.internalNotes}</Text>
                </CardBody>
              </Card>
            )}
          </VStack>
        </GridItem>

        {/* Right Column - Financial Summary */}
        <GridItem>
          <VStack spacing={6} align="stretch">
            <Card>
              <CardHeader>
                <Heading size="md">Financial Summary</Heading>
              </CardHeader>
              <CardBody>
                <VStack spacing={4} align="stretch">
                  <Box>
                    <Text fontSize="sm" color="gray.500">Monthly Rent</Text>
                    <Text fontSize="2xl" fontWeight="bold">
                      {formatCurrency(lease.monthlyRent, lease.currency)}
                    </Text>
                  </Box>

                  <Divider />

                  <Box>
                    <Text fontSize="sm" color="gray.500">Payment Frequency</Text>
                    <Text>{paymentFrequencyLabels[lease.paymentFrequency]}</Text>
                  </Box>

                  <Box>
                    <Text fontSize="sm" color="gray.500">Rent Due Day</Text>
                    <Text>{lease.rentDueDay}{getDaySuffix(lease.rentDueDay)} of the month</Text>
                  </Box>

                  {lease.deposit && (
                    <>
                      <Divider />
                      <Box>
                        <Text fontSize="sm" color="gray.500">Deposit</Text>
                        <HStack>
                          <Text fontWeight="medium">
                            {formatCurrency(lease.deposit, lease.currency)}
                          </Text>
                          <Badge colorScheme={lease.depositPaid ? 'green' : 'yellow'}>
                            {lease.depositPaid ? 'Paid' : 'Pending'}
                          </Badge>
                        </HStack>
                      </Box>
                    </>
                  )}
                </VStack>
              </CardBody>
            </Card>

            {/* Termination Info */}
            {lease.status === 'terminated' && (
              <Card borderColor="red.200" borderWidth="2px">
                <CardHeader>
                  <Heading size="md" color="red.500">Termination</Heading>
                </CardHeader>
                <CardBody>
                  <VStack spacing={3} align="stretch">
                    <Box>
                      <Text fontSize="sm" color="gray.500">Terminated On</Text>
                      <Text>{lease.terminatedAt ? formatDate(lease.terminatedAt) : 'N/A'}</Text>
                    </Box>
                    {lease.terminationReason && (
                      <Box>
                        <Text fontSize="sm" color="gray.500">Reason</Text>
                        <Text>{lease.terminationReason}</Text>
                      </Box>
                    )}
                  </VStack>
                </CardBody>
              </Card>
            )}

            {/* Timestamps */}
            <Card>
              <CardBody>
                <VStack spacing={2} align="stretch">
                  <HStack justify="space-between">
                    <Text fontSize="sm" color="gray.500">Created</Text>
                    <Text fontSize="sm">{formatDate(lease.createdAt)}</Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text fontSize="sm" color="gray.500">Updated</Text>
                    <Text fontSize="sm">{formatDate(lease.updatedAt)}</Text>
                  </HStack>
                </VStack>
              </CardBody>
            </Card>
          </VStack>
        </GridItem>
      </Grid>

      {/* Terminate Modal */}
      <Modal isOpen={terminateModal.isOpen} onClose={terminateModal.onClose}>
        <ModalOverlay />
        <ModalContent>
          <Form method="post">
            <input type="hidden" name="intent" value="terminate" />
            <ModalHeader>Terminate Lease</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <VStack spacing={4}>
                <Alert status="warning">
                  <AlertIcon />
                  This action will terminate the lease. This cannot be undone.
                </Alert>

                <FormControl>
                  <FormLabel>Termination Date</FormLabel>
                  <Input
                    name="terminationDate"
                    type="date"
                    defaultValue={new Date().toISOString().split('T')[0]}
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Reason (Optional)</FormLabel>
                  <Textarea
                    name="reason"
                    placeholder="Reason for termination..."
                    rows={3}
                  />
                </FormControl>
              </VStack>
            </ModalBody>
            <ModalFooter>
              <HStack spacing={3}>
                <Button variant="ghost" onClick={terminateModal.onClose}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  colorScheme="red"
                  isLoading={isSubmitting}
                >
                  Terminate Lease
                </Button>
              </HStack>
            </ModalFooter>
          </Form>
        </ModalContent>
      </Modal>
    </Box>
  );
}
