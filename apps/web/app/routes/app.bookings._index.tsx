import {
  Box,
  Heading,
  Button,
  HStack,
  Input,
  InputGroup,
  InputLeftElement,
  Select,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Card,
  CardBody,
  Text,
  Flex,
  Icon,
  Spinner,
  Center,
  Alert,
  AlertIcon,
} from '@chakra-ui/react';
import type { LoaderFunctionArgs } from '@remix-run/cloudflare';
import { json } from '@remix-run/cloudflare';
import { Link, useLoaderData, useSearchParams, useNavigation } from '@remix-run/react';
import {
  FiSearch,
  FiPlus,
  FiMoreVertical,
  FiEye,
  FiCheck,
  FiX,
  FiLogIn,
  FiLogOut,
  FiCalendar,
} from 'react-icons/fi';
import { createApiClient } from '~/lib/api.server';
import { getSession } from '~/lib/session.server';

interface Booking {
  id: string;
  booking_ref: string;
  unit_name: string;
  property_name: string;
  guest_first_name: string;
  guest_last_name: string;
  guest_email: string;
  check_in_date: string;
  check_out_date: string;
  total_nights: number;
  total_amount: number;
  currency: string;
  status: string;
  payment_status: string;
  source: string;
}

interface LoaderData {
  bookings: Booking[];
  total: number;
  page: number;
  pageSize: number;
  error?: string;
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  const session = await getSession(request, context);
  const accessToken = session.get('accessToken');

  if (!accessToken) {
    return json<LoaderData>({ bookings: [], total: 0, page: 1, pageSize: 20, error: 'Not authenticated' });
  }

  const url = new URL(request.url);
  const params: Record<string, string> = {};

  const status = url.searchParams.get('status');
  const source = url.searchParams.get('source');
  const page = url.searchParams.get('page') || '1';

  if (status) params.status = status;
  if (source) params.source = source;
  params.page = page;
  params.pageSize = '20';

  try {
    const api = createApiClient(context, accessToken);
    const response = await api.get<Booking[]>('/bookings', params);

    if (response.success && response.data) {
      return json<LoaderData>({
        bookings: response.data,
        total: response.meta?.total || response.data.length,
        page: response.meta?.page || 1,
        pageSize: response.meta?.pageSize || 20,
      });
    }

    return json<LoaderData>({
      bookings: [],
      total: 0,
      page: 1,
      pageSize: 20,
      error: response.error?.message || 'Failed to load bookings',
    });
  } catch (error) {
    console.error('Error loading bookings:', error);
    return json<LoaderData>({
      bookings: [],
      total: 0,
      page: 1,
      pageSize: 20,
      error: 'Failed to load bookings',
    });
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

const paymentColors: Record<string, string> = {
  unpaid: 'red',
  partial: 'yellow',
  paid: 'green',
  refunded: 'purple',
  failed: 'red',
};

const sourceLabels: Record<string, string> = {
  direct: 'Direct',
  airbnb: 'Airbnb',
  booking_com: 'Booking.com',
  vrbo: 'VRBO',
  expedia: 'Expedia',
  other: 'Other',
};

function formatCurrency(amount: number, currency: string = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount / 100);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function BookingsList() {
  const { bookings, total, error } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigation = useNavigation();
  const isLoading = navigation.state === 'loading';

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSearchParams((prev) => {
      if (value) {
        prev.set('status', value);
      } else {
        prev.delete('status');
      }
      prev.delete('page');
      return prev;
    });
  };

  const handleSourceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSearchParams((prev) => {
      if (value) {
        prev.set('source', value);
      } else {
        prev.delete('source');
      }
      prev.delete('page');
      return prev;
    });
  };

  return (
    <Box>
      {/* Header */}
      <Flex justify="space-between" align="center" mb={6}>
        <Heading size="lg">Bookings</Heading>
        <Button as={Link} to="/app/bookings/new" leftIcon={<Icon as={FiPlus} />} colorScheme="brand">
          New Booking
        </Button>
      </Flex>

      {/* Filters */}
      <Card mb={6}>
        <CardBody>
          <HStack spacing={4}>
            <InputGroup maxW="300px">
              <InputLeftElement>
                <Icon as={FiSearch} color="gray.400" />
              </InputLeftElement>
              <Input placeholder="Search bookings..." />
            </InputGroup>
            <Select
              maxW="180px"
              placeholder="All Status"
              value={searchParams.get('status') || ''}
              onChange={handleStatusChange}
            >
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="checked_in">Checked In</option>
              <option value="checked_out">Checked Out</option>
              <option value="cancelled">Cancelled</option>
            </Select>
            <Select
              maxW="180px"
              placeholder="All Sources"
              value={searchParams.get('source') || ''}
              onChange={handleSourceChange}
            >
              <option value="direct">Direct</option>
              <option value="airbnb">Airbnb</option>
              <option value="booking_com">Booking.com</option>
              <option value="vrbo">VRBO</option>
            </Select>
          </HStack>
        </CardBody>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert status="error" mb={6}>
          <AlertIcon />
          {error}
        </Alert>
      )}

      {/* Bookings Table */}
      <Card>
        <CardBody p={0}>
          {isLoading ? (
            <Center py={10}>
              <Spinner size="lg" color="brand.500" />
            </Center>
          ) : bookings.length === 0 ? (
            <Center py={10} flexDirection="column">
              <Icon as={FiCalendar} boxSize={12} color="gray.300" mb={4} />
              <Text color="gray.500" mb={4}>
                No bookings found
              </Text>
              <Button as={Link} to="/app/bookings/new" colorScheme="brand" size="sm">
                Create your first booking
              </Button>
            </Center>
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Booking</Th>
                  <Th>Guest</Th>
                  <Th>Unit</Th>
                  <Th>Dates</Th>
                  <Th isNumeric>Amount</Th>
                  <Th>Status</Th>
                  <Th width="50px"></Th>
                </Tr>
              </Thead>
              <Tbody>
                {bookings.map((booking) => (
                  <Tr key={booking.id} _hover={{ bg: 'gray.50' }}>
                    <Td>
                      <Link to={`/app/bookings/${booking.id}`}>
                        <Text fontWeight="medium" color="brand.600" _hover={{ textDecoration: 'underline' }}>
                          {booking.booking_ref}
                        </Text>
                      </Link>
                      <Text fontSize="xs" color="gray.500">
                        {sourceLabels[booking.source]}
                      </Text>
                    </Td>
                    <Td>
                      <Text fontWeight="medium">
                        {booking.guest_first_name} {booking.guest_last_name}
                      </Text>
                      <Text fontSize="sm" color="gray.500">
                        {booking.guest_email}
                      </Text>
                    </Td>
                    <Td>
                      <Text>{booking.unit_name}</Text>
                      <Text fontSize="sm" color="gray.500">
                        {booking.property_name}
                      </Text>
                    </Td>
                    <Td>
                      <Text>{formatDate(booking.check_in_date)}</Text>
                      <Text fontSize="sm" color="gray.500">
                        {booking.total_nights} nights
                      </Text>
                    </Td>
                    <Td isNumeric>
                      <Text fontWeight="medium">
                        {formatCurrency(booking.total_amount, booking.currency)}
                      </Text>
                      <Badge colorScheme={paymentColors[booking.payment_status]} fontSize="xs">
                        {booking.payment_status}
                      </Badge>
                    </Td>
                    <Td>
                      <Badge colorScheme={statusColors[booking.status]}>
                        {statusLabels[booking.status]}
                      </Badge>
                    </Td>
                    <Td>
                      <Menu>
                        <MenuButton
                          as={IconButton}
                          icon={<Icon as={FiMoreVertical} />}
                          variant="ghost"
                          size="sm"
                          aria-label="Actions"
                        />
                        <MenuList>
                          <MenuItem as={Link} to={`/app/bookings/${booking.id}`} icon={<Icon as={FiEye} />}>
                            View Details
                          </MenuItem>
                          {booking.status === 'pending' && (
                            <MenuItem icon={<Icon as={FiCheck} />} color="green.500">
                              Confirm
                            </MenuItem>
                          )}
                          {booking.status === 'confirmed' && (
                            <MenuItem icon={<Icon as={FiLogIn} />} color="blue.500">
                              Check In
                            </MenuItem>
                          )}
                          {booking.status === 'checked_in' && (
                            <MenuItem icon={<Icon as={FiLogOut} />}>
                              Check Out
                            </MenuItem>
                          )}
                          {['pending', 'confirmed'].includes(booking.status) && (
                            <MenuItem icon={<Icon as={FiX} />} color="red.500">
                              Cancel
                            </MenuItem>
                          )}
                        </MenuList>
                      </Menu>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </CardBody>
      </Card>

      {/* Pagination info */}
      {bookings.length > 0 && (
        <Text mt={4} fontSize="sm" color="gray.500">
          Showing {bookings.length} of {total} bookings
        </Text>
      )}
    </Box>
  );
}
