import {
  Box,
  Heading,
  Card,
  CardBody,
  SimpleGrid,
  Text,
  Badge,
  HStack,
  VStack,
  Button,
  Icon,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Flex,
  Divider,
  Alert,
  AlertIcon,
  Spinner,
  Center,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  useDisclosure,
  Textarea,
  FormControl,
  FormLabel,
} from '@chakra-ui/react';
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/cloudflare';
import { json, redirect } from '@remix-run/cloudflare';
import { Link, useLoaderData, useParams, useActionData, useNavigation, Form } from '@remix-run/react';
import {
  FiChevronRight,
  FiCheck,
  FiX,
  FiLogIn,
  FiLogOut,
  FiUser,
  FiCalendar,
  FiHome,
  FiMail,
  FiPhone,
} from 'react-icons/fi';
import { useState } from 'react';
import { createApiClient } from '~/lib/api.server';
import { getSession } from '~/lib/session.server';

interface Booking {
  id: string;
  booking_ref: string;
  unit_id: string;
  unit_name: string;
  property_id: string;
  property_name: string;
  guest_id: string;
  guest_first_name: string;
  guest_last_name: string;
  guest_email: string;
  guest_phone: string | null;
  check_in_date: string;
  check_out_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  adults: number;
  children: number;
  infants: number;
  status: string;
  currency: string;
  nightly_rate: number;
  total_nights: number;
  subtotal: number;
  cleaning_fee: number;
  service_fee: number;
  taxes: number;
  discount: number;
  total_amount: number;
  amount_paid: number;
  payment_status: string;
  source: string;
  guest_notes: string | null;
  internal_notes: string | null;
  special_requests: string | null;
  confirmed_at: number | null;
  checked_in_at: number | null;
  checked_out_at: number | null;
  cancelled_at: number | null;
  cancellation_reason: string | null;
  created_at: number;
}

interface LoaderData {
  booking: Booking | null;
  error?: string;
}

interface ActionData {
  success?: boolean;
  error?: string;
}

export async function loader({ request, context, params }: LoaderFunctionArgs) {
  const session = await getSession(request, context);
  const accessToken = session.get('accessToken');

  if (!accessToken) {
    return json<LoaderData>({ booking: null, error: 'Not authenticated' });
  }

  try {
    const api = createApiClient(context, accessToken);
    const response = await api.get<Booking>(`/bookings/${params.id}`);

    if (response.success && response.data) {
      return json<LoaderData>({ booking: response.data });
    }

    return json<LoaderData>({ booking: null, error: response.error?.message || 'Booking not found' });
  } catch (error) {
    return json<LoaderData>({ booking: null, error: 'Failed to load booking' });
  }
}

export async function action({ request, context, params }: ActionFunctionArgs) {
  const session = await getSession(request, context);
  const accessToken = session.get('accessToken');

  if (!accessToken) {
    return json<ActionData>({ error: 'Not authenticated' }, { status: 401 });
  }

  const formData = await request.formData();
  const intent = formData.get('intent');

  const api = createApiClient(context, accessToken);

  try {
    switch (intent) {
      case 'confirm': {
        const result = await api.post(`/bookings/${params.id}/confirm`, {});
        if (!result.success) {
          return json<ActionData>({ error: result.error?.message || 'Failed to confirm' });
        }
        return json<ActionData>({ success: true });
      }

      case 'checkIn': {
        const result = await api.post(`/bookings/${params.id}/check-in`, {});
        if (!result.success) {
          return json<ActionData>({ error: result.error?.message || 'Failed to check in' });
        }
        return json<ActionData>({ success: true });
      }

      case 'checkOut': {
        const result = await api.post(`/bookings/${params.id}/check-out`, {});
        if (!result.success) {
          return json<ActionData>({ error: result.error?.message || 'Failed to check out' });
        }
        return json<ActionData>({ success: true });
      }

      case 'cancel': {
        const reason = formData.get('reason') as string;
        const result = await api.post(`/bookings/${params.id}/cancel`, { reason });
        if (!result.success) {
          return json<ActionData>({ error: result.error?.message || 'Failed to cancel' });
        }
        return json<ActionData>({ success: true });
      }

      default:
        return json<ActionData>({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    return json<ActionData>({ error: 'Action failed' }, { status: 500 });
  }
}

const statusColors: Record<string, string> = {
  pending: 'yellow',
  confirmed: 'green',
  checked_in: 'blue',
  checked_out: 'gray',
  cancelled: 'red',
  no_show: 'orange',
};

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  checked_in: 'Checked In',
  checked_out: 'Checked Out',
  cancelled: 'Cancelled',
  no_show: 'No Show',
};

function formatCurrency(amount: number, currency: string = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount / 100);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString('en-GB');
}

export default function BookingDetail() {
  const { id } = useParams();
  const { booking, error } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const toast = useToast();
  const cancelModal = useDisclosure();
  const [cancelReason, setCancelReason] = useState('');

  const isSubmitting = navigation.state === 'submitting';

  if (error || !booking) {
    return (
      <Box>
        <Alert status="error">
          <AlertIcon />
          {error || 'Booking not found'}
        </Alert>
      </Box>
    );
  }

  const canConfirm = booking.status === 'pending';
  const canCheckIn = booking.status === 'confirmed';
  const canCheckOut = booking.status === 'checked_in';
  const canCancel = ['pending', 'confirmed'].includes(booking.status);

  return (
    <Box>
      {/* Breadcrumb */}
      <Breadcrumb mb={4} separator={<Icon as={FiChevronRight} color="gray.400" />}>
        <BreadcrumbItem>
          <BreadcrumbLink as={Link} to="/app/bookings">
            Bookings
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>
          <BreadcrumbLink>{booking.booking_ref}</BreadcrumbLink>
        </BreadcrumbItem>
      </Breadcrumb>

      {/* Header */}
      <Flex justify="space-between" align="start" mb={6}>
        <Box>
          <HStack mb={2}>
            <Heading size="lg">{booking.booking_ref}</Heading>
            <Badge colorScheme={statusColors[booking.status]} fontSize="md" px={3} py={1}>
              {statusLabels[booking.status]}
            </Badge>
          </HStack>
          <HStack color="gray.600" spacing={4}>
            <HStack>
              <Icon as={FiHome} />
              <Text>{booking.unit_name} - {booking.property_name}</Text>
            </HStack>
          </HStack>
        </Box>
        <HStack spacing={3}>
          {canConfirm && (
            <Form method="post">
              <input type="hidden" name="intent" value="confirm" />
              <Button
                type="submit"
                leftIcon={<Icon as={FiCheck} />}
                colorScheme="green"
                isLoading={isSubmitting}
              >
                Confirm Booking
              </Button>
            </Form>
          )}
          {canCheckIn && (
            <Form method="post">
              <input type="hidden" name="intent" value="checkIn" />
              <Button
                type="submit"
                leftIcon={<Icon as={FiLogIn} />}
                colorScheme="blue"
                isLoading={isSubmitting}
              >
                Check In
              </Button>
            </Form>
          )}
          {canCheckOut && (
            <Form method="post">
              <input type="hidden" name="intent" value="checkOut" />
              <Button
                type="submit"
                leftIcon={<Icon as={FiLogOut} />}
                colorScheme="gray"
                isLoading={isSubmitting}
              >
                Check Out
              </Button>
            </Form>
          )}
          {canCancel && (
            <Button
              leftIcon={<Icon as={FiX} />}
              variant="outline"
              colorScheme="red"
              onClick={cancelModal.onOpen}
            >
              Cancel
            </Button>
          )}
        </HStack>
      </Flex>

      {actionData?.error && (
        <Alert status="error" mb={6}>
          <AlertIcon />
          {actionData.error}
        </Alert>
      )}

      {actionData?.success && (
        <Alert status="success" mb={6}>
          <AlertIcon />
          Action completed successfully
        </Alert>
      )}

      {/* Stats */}
      <SimpleGrid columns={{ base: 1, md: 4 }} spacing={4} mb={6}>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Total Amount</StatLabel>
              <StatNumber>{formatCurrency(booking.total_amount, booking.currency)}</StatNumber>
              <StatHelpText>
                <Badge colorScheme={booking.payment_status === 'paid' ? 'green' : 'yellow'}>
                  {booking.payment_status}
                </Badge>
              </StatHelpText>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Check-in</StatLabel>
              <StatNumber fontSize="lg">{formatDate(booking.check_in_date)}</StatNumber>
              <StatHelpText>{booking.check_in_time || '15:00'}</StatHelpText>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Check-out</StatLabel>
              <StatNumber fontSize="lg">{formatDate(booking.check_out_date)}</StatNumber>
              <StatHelpText>{booking.check_out_time || '11:00'}</StatHelpText>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Duration</StatLabel>
              <StatNumber>{booking.total_nights}</StatNumber>
              <StatHelpText>nights</StatHelpText>
            </Stat>
          </CardBody>
        </Card>
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
        {/* Guest Information */}
        <Card>
          <CardBody>
            <Heading size="md" mb={4}>
              Guest Information
            </Heading>
            <VStack align="stretch" spacing={3}>
              <HStack>
                <Icon as={FiUser} color="gray.400" />
                <Text fontWeight="medium">
                  {booking.guest_first_name} {booking.guest_last_name}
                </Text>
              </HStack>
              <HStack>
                <Icon as={FiMail} color="gray.400" />
                <Text>{booking.guest_email}</Text>
              </HStack>
              {booking.guest_phone && (
                <HStack>
                  <Icon as={FiPhone} color="gray.400" />
                  <Text>{booking.guest_phone}</Text>
                </HStack>
              )}
              <Divider />
              <HStack>
                <Text color="gray.500">Guests:</Text>
                <Text>
                  {booking.adults} adult{booking.adults !== 1 ? 's' : ''}
                  {booking.children > 0 && `, ${booking.children} child${booking.children !== 1 ? 'ren' : ''}`}
                  {booking.infants > 0 && `, ${booking.infants} infant${booking.infants !== 1 ? 's' : ''}`}
                </Text>
              </HStack>
            </VStack>
          </CardBody>
        </Card>

        {/* Pricing Breakdown */}
        <Card>
          <CardBody>
            <Heading size="md" mb={4}>
              Pricing
            </Heading>
            <VStack align="stretch" spacing={2}>
              <Flex justify="space-between">
                <Text color="gray.600">
                  {formatCurrency(booking.nightly_rate, booking.currency)} x {booking.total_nights} nights
                </Text>
                <Text>{formatCurrency(booking.subtotal, booking.currency)}</Text>
              </Flex>
              {booking.cleaning_fee > 0 && (
                <Flex justify="space-between">
                  <Text color="gray.600">Cleaning fee</Text>
                  <Text>{formatCurrency(booking.cleaning_fee, booking.currency)}</Text>
                </Flex>
              )}
              {booking.service_fee > 0 && (
                <Flex justify="space-between">
                  <Text color="gray.600">Service fee</Text>
                  <Text>{formatCurrency(booking.service_fee, booking.currency)}</Text>
                </Flex>
              )}
              {booking.taxes > 0 && (
                <Flex justify="space-between">
                  <Text color="gray.600">Taxes</Text>
                  <Text>{formatCurrency(booking.taxes, booking.currency)}</Text>
                </Flex>
              )}
              {booking.discount > 0 && (
                <Flex justify="space-between" color="green.500">
                  <Text>Discount</Text>
                  <Text>-{formatCurrency(booking.discount, booking.currency)}</Text>
                </Flex>
              )}
              <Divider />
              <Flex justify="space-between" fontWeight="bold">
                <Text>Total</Text>
                <Text>{formatCurrency(booking.total_amount, booking.currency)}</Text>
              </Flex>
              <Flex justify="space-between" color="gray.500">
                <Text>Paid</Text>
                <Text>{formatCurrency(booking.amount_paid, booking.currency)}</Text>
              </Flex>
            </VStack>
          </CardBody>
        </Card>

        {/* Notes */}
        {(booking.special_requests || booking.guest_notes || booking.internal_notes) && (
          <Card>
            <CardBody>
              <Heading size="md" mb={4}>
                Notes
              </Heading>
              <VStack align="stretch" spacing={4}>
                {booking.special_requests && (
                  <Box>
                    <Text fontWeight="medium" color="gray.500" mb={1}>
                      Special Requests
                    </Text>
                    <Text>{booking.special_requests}</Text>
                  </Box>
                )}
                {booking.guest_notes && (
                  <Box>
                    <Text fontWeight="medium" color="gray.500" mb={1}>
                      Guest Notes
                    </Text>
                    <Text>{booking.guest_notes}</Text>
                  </Box>
                )}
                {booking.internal_notes && (
                  <Box>
                    <Text fontWeight="medium" color="gray.500" mb={1}>
                      Internal Notes
                    </Text>
                    <Text>{booking.internal_notes}</Text>
                  </Box>
                )}
              </VStack>
            </CardBody>
          </Card>
        )}

        {/* Timeline */}
        <Card>
          <CardBody>
            <Heading size="md" mb={4}>
              Timeline
            </Heading>
            <VStack align="stretch" spacing={2}>
              <Flex justify="space-between">
                <Text color="gray.500">Created</Text>
                <Text>{formatTimestamp(booking.created_at)}</Text>
              </Flex>
              {booking.confirmed_at && (
                <Flex justify="space-between">
                  <Text color="gray.500">Confirmed</Text>
                  <Text>{formatTimestamp(booking.confirmed_at)}</Text>
                </Flex>
              )}
              {booking.checked_in_at && (
                <Flex justify="space-between">
                  <Text color="gray.500">Checked In</Text>
                  <Text>{formatTimestamp(booking.checked_in_at)}</Text>
                </Flex>
              )}
              {booking.checked_out_at && (
                <Flex justify="space-between">
                  <Text color="gray.500">Checked Out</Text>
                  <Text>{formatTimestamp(booking.checked_out_at)}</Text>
                </Flex>
              )}
              {booking.cancelled_at && (
                <>
                  <Flex justify="space-between" color="red.500">
                    <Text>Cancelled</Text>
                    <Text>{formatTimestamp(booking.cancelled_at)}</Text>
                  </Flex>
                  {booking.cancellation_reason && (
                    <Text fontSize="sm" color="gray.500">
                      Reason: {booking.cancellation_reason}
                    </Text>
                  )}
                </>
              )}
            </VStack>
          </CardBody>
        </Card>
      </SimpleGrid>

      {/* Cancel Modal */}
      <Modal isOpen={cancelModal.isOpen} onClose={cancelModal.onClose}>
        <ModalOverlay />
        <ModalContent>
          <Form method="post">
            <input type="hidden" name="intent" value="cancel" />
            <ModalHeader>Cancel Booking</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <Text mb={4}>
                Are you sure you want to cancel booking {booking.booking_ref}?
              </Text>
              <FormControl>
                <FormLabel>Reason (optional)</FormLabel>
                <Textarea
                  name="reason"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Enter cancellation reason..."
                />
              </FormControl>
            </ModalBody>
            <ModalFooter>
              <Button variant="ghost" mr={3} onClick={cancelModal.onClose}>
                Keep Booking
              </Button>
              <Button type="submit" colorScheme="red" isLoading={isSubmitting}>
                Cancel Booking
              </Button>
            </ModalFooter>
          </Form>
        </ModalContent>
      </Modal>
    </Box>
  );
}
