import {
  Box,
  Button,
  Card,
  CardBody,
  Heading,
  HStack,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Text,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Select,
  VStack,
  Flex,
  Spacer,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  SimpleGrid,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
} from '@chakra-ui/react';
import { json, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { useLoaderData, useNavigate, useSearchParams, Form, Link } from '@remix-run/react';
import { FiPlus, FiMoreVertical, FiEye, FiSend, FiDollarSign, FiDownload } from 'react-icons/fi';
import { requireAuth } from '~/lib/auth.server';
import { apiClient } from '~/lib/api.server';

interface Invoice {
  id: string;
  invoiceNumber: string;
  bookingId: string | null;
  leaseId: string | null;
  guestId: string;
  type: string;
  status: string;
  issueDate: string;
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
  currency: string;
  guestName: string | null;
  guestEmail: string | null;
  createdAt: string;
}

interface Payment {
  id: string;
  invoiceId: string;
  invoiceNumber: string | null;
  amount: number;
  currency: string;
  paymentMethod: string;
  status: string;
  processedAt: string | null;
  createdAt: string;
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { token } = await requireAuth(request, context);
  const api = apiClient(context, token);

  const url = new URL(request.url);
  const tab = url.searchParams.get('tab') || 'invoices';

  // Fetch invoices
  const invoicesParams = new URLSearchParams();
  const status = url.searchParams.get('status');
  if (status) invoicesParams.set('status', status);
  invoicesParams.set('pageSize', '20');

  const invoicesResponse = await api.get(`/payments/invoices?${invoicesParams.toString()}`);
  const invoicesData = invoicesResponse.ok
    ? ((await invoicesResponse.json()) as { invoices: Invoice[]; total: number })
    : { invoices: [], total: 0 };

  // Fetch recent payments
  const paymentsResponse = await api.get('/payments/payments?pageSize=10');
  const paymentsData = paymentsResponse.ok
    ? ((await paymentsResponse.json()) as { payments: Payment[]; total: number })
    : { payments: [], total: 0 };

  // Calculate summary stats
  const today = new Date().toISOString().split('T')[0];
  let totalOutstanding = 0;
  let overdueAmount = 0;
  let totalPaid = 0;

  for (const invoice of invoicesData.invoices) {
    const remaining = invoice.totalAmount - invoice.paidAmount;
    if (remaining > 0) {
      totalOutstanding += remaining;
      if (invoice.dueDate < today && invoice.status !== 'paid' && invoice.status !== 'cancelled') {
        overdueAmount += remaining;
      }
    }
    totalPaid += invoice.paidAmount;
  }

  return json({
    invoices: invoicesData.invoices,
    invoicesTotal: invoicesData.total,
    payments: paymentsData.payments,
    paymentsTotal: paymentsData.total,
    stats: {
      totalOutstanding,
      overdueAmount,
      totalPaid,
    },
    tab,
  });
}

const statusColors: Record<string, string> = {
  draft: 'gray',
  sent: 'blue',
  paid: 'green',
  partial: 'yellow',
  overdue: 'red',
  cancelled: 'gray',
  refunded: 'purple',
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  paid: 'Paid',
  partial: 'Partial',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

const typeLabels: Record<string, string> = {
  booking: 'Booking',
  rent: 'Rent',
  deposit: 'Deposit',
  cleaning: 'Cleaning',
  damage: 'Damage',
  other: 'Other',
};

const paymentMethodLabels: Record<string, string> = {
  card: 'Card',
  bank_transfer: 'Bank Transfer',
  cash: 'Cash',
  check: 'Check',
  other: 'Other',
};

const paymentStatusColors: Record<string, string> = {
  pending: 'yellow',
  processing: 'blue',
  succeeded: 'green',
  failed: 'red',
  cancelled: 'gray',
  refunded: 'purple',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
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

export default function FinancesIndex() {
  const { invoices, payments, stats, tab } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const tabIndex = tab === 'payments' ? 1 : 0;

  return (
    <Box>
      <Flex mb={6} align="center">
        <Box>
          <Heading size="lg">Finances</Heading>
          <Text color="gray.600" mt={1}>
            Manage invoices, payments, and financial records
          </Text>
        </Box>
        <Spacer />
        <Button as={Link} to="/app/finances/invoices/new" leftIcon={<FiPlus />} colorScheme="brand">
          New Invoice
        </Button>
      </Flex>

      {/* Summary Stats */}
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6} mb={6}>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Total Outstanding</StatLabel>
              <StatNumber>{formatCurrency(stats.totalOutstanding, 'GBP')}</StatNumber>
              <StatHelpText>Across all invoices</StatHelpText>
            </Stat>
          </CardBody>
        </Card>

        <Card borderColor={stats.overdueAmount > 0 ? 'red.200' : undefined} borderWidth={stats.overdueAmount > 0 ? '2px' : undefined}>
          <CardBody>
            <Stat>
              <StatLabel color={stats.overdueAmount > 0 ? 'red.500' : undefined}>Overdue</StatLabel>
              <StatNumber color={stats.overdueAmount > 0 ? 'red.500' : undefined}>
                {formatCurrency(stats.overdueAmount, 'GBP')}
              </StatNumber>
              <StatHelpText>Past due date</StatHelpText>
            </Stat>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Total Received</StatLabel>
              <StatNumber color="green.500">{formatCurrency(stats.totalPaid, 'GBP')}</StatNumber>
              <StatHelpText>This period</StatHelpText>
            </Stat>
          </CardBody>
        </Card>
      </SimpleGrid>

      {/* Tabs */}
      <Card>
        <Tabs index={tabIndex} onChange={(index) => navigate(`?tab=${index === 1 ? 'payments' : 'invoices'}`)}>
          <TabList px={4} pt={4}>
            <Tab>Invoices</Tab>
            <Tab>Payments</Tab>
          </TabList>

          <TabPanels>
            {/* Invoices Tab */}
            <TabPanel p={0}>
              {/* Filters */}
              <Box px={4} py={3} borderBottomWidth="1px">
                <Form method="get">
                  <input type="hidden" name="tab" value="invoices" />
                  <HStack spacing={4}>
                    <Select
                      name="status"
                      placeholder="All Statuses"
                      defaultValue={searchParams.get('status') || ''}
                      w="200px"
                    >
                      <option value="draft">Draft</option>
                      <option value="sent">Sent</option>
                      <option value="partial">Partial</option>
                      <option value="paid">Paid</option>
                      <option value="overdue">Overdue</option>
                      <option value="cancelled">Cancelled</option>
                    </Select>
                    <Button type="submit" colorScheme="brand" variant="outline" size="sm">
                      Filter
                    </Button>
                    {searchParams.get('status') && (
                      <Button variant="ghost" size="sm" onClick={() => navigate('/app/finances')}>
                        Clear
                      </Button>
                    )}
                  </HStack>
                </Form>
              </Box>

              {/* Invoices Table */}
              <CardBody p={0}>
                {invoices.length === 0 ? (
                  <VStack py={12} spacing={4}>
                    <Text color="gray.500">No invoices found</Text>
                    <Button as={Link} to="/app/finances/invoices/new" leftIcon={<FiPlus />} colorScheme="brand" size="sm">
                      Create First Invoice
                    </Button>
                  </VStack>
                ) : (
                  <Table>
                    <Thead>
                      <Tr>
                        <Th>Invoice</Th>
                        <Th>Guest</Th>
                        <Th>Type</Th>
                        <Th>Due Date</Th>
                        <Th>Amount</Th>
                        <Th>Status</Th>
                        <Th w="50px"></Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {invoices.map((invoice) => {
                        const isOverdue =
                          invoice.dueDate < new Date().toISOString().split('T')[0] &&
                          invoice.status !== 'paid' &&
                          invoice.status !== 'cancelled';

                        return (
                          <Tr
                            key={invoice.id}
                            _hover={{ bg: 'gray.50' }}
                            cursor="pointer"
                            onClick={() => navigate(`/app/finances/invoices/${invoice.id}`)}
                          >
                            <Td>
                              <Text fontWeight="medium">{invoice.invoiceNumber}</Text>
                            </Td>
                            <Td>
                              <VStack align="start" spacing={0}>
                                <Text fontWeight="medium">{invoice.guestName || 'Unknown'}</Text>
                                <Text fontSize="sm" color="gray.500">
                                  {invoice.guestEmail}
                                </Text>
                              </VStack>
                            </Td>
                            <Td>
                              <Text fontSize="sm">{typeLabels[invoice.type] || invoice.type}</Text>
                            </Td>
                            <Td>
                              <Text fontSize="sm" color={isOverdue ? 'red.500' : undefined}>
                                {formatDate(invoice.dueDate)}
                              </Text>
                            </Td>
                            <Td>
                              <VStack align="start" spacing={0}>
                                <Text fontWeight="medium">{formatCurrency(invoice.totalAmount, invoice.currency)}</Text>
                                {invoice.paidAmount > 0 && invoice.paidAmount < invoice.totalAmount && (
                                  <Text fontSize="sm" color="gray.500">
                                    Paid: {formatCurrency(invoice.paidAmount, invoice.currency)}
                                  </Text>
                                )}
                              </VStack>
                            </Td>
                            <Td>
                              <Badge colorScheme={isOverdue ? 'red' : statusColors[invoice.status] || 'gray'}>
                                {isOverdue ? 'Overdue' : statusLabels[invoice.status] || invoice.status}
                              </Badge>
                            </Td>
                            <Td onClick={(e) => e.stopPropagation()}>
                              <Menu>
                                <MenuButton as={IconButton} icon={<FiMoreVertical />} variant="ghost" size="sm" />
                                <MenuList>
                                  <MenuItem icon={<FiEye />} onClick={() => navigate(`/app/finances/invoices/${invoice.id}`)}>
                                    View Details
                                  </MenuItem>
                                  {invoice.status === 'draft' && (
                                    <MenuItem icon={<FiSend />}>Send Invoice</MenuItem>
                                  )}
                                  {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                                    <MenuItem
                                      icon={<FiDollarSign />}
                                      onClick={() => navigate(`/app/finances/invoices/${invoice.id}/record-payment`)}
                                    >
                                      Record Payment
                                    </MenuItem>
                                  )}
                                  <MenuItem icon={<FiDownload />}>Download PDF</MenuItem>
                                </MenuList>
                              </Menu>
                            </Td>
                          </Tr>
                        );
                      })}
                    </Tbody>
                  </Table>
                )}
              </CardBody>
            </TabPanel>

            {/* Payments Tab */}
            <TabPanel p={0}>
              <CardBody p={0}>
                {payments.length === 0 ? (
                  <VStack py={12} spacing={4}>
                    <Text color="gray.500">No payments recorded yet</Text>
                  </VStack>
                ) : (
                  <Table>
                    <Thead>
                      <Tr>
                        <Th>Date</Th>
                        <Th>Invoice</Th>
                        <Th>Method</Th>
                        <Th>Amount</Th>
                        <Th>Status</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {payments.map((payment) => (
                        <Tr key={payment.id} _hover={{ bg: 'gray.50' }}>
                          <Td>
                            <Text fontSize="sm">
                              {formatDate(payment.processedAt || payment.createdAt)}
                            </Text>
                          </Td>
                          <Td>
                            <Text
                              fontWeight="medium"
                              color="brand.600"
                              cursor="pointer"
                              onClick={() => navigate(`/app/finances/invoices/${payment.invoiceId}`)}
                            >
                              {payment.invoiceNumber || payment.invoiceId}
                            </Text>
                          </Td>
                          <Td>
                            <Text fontSize="sm">
                              {paymentMethodLabels[payment.paymentMethod] || payment.paymentMethod}
                            </Text>
                          </Td>
                          <Td>
                            <Text fontWeight="medium">{formatCurrency(payment.amount, payment.currency)}</Text>
                          </Td>
                          <Td>
                            <Badge colorScheme={paymentStatusColors[payment.status] || 'gray'}>
                              {payment.status}
                            </Badge>
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                )}
              </CardBody>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </Card>
    </Box>
  );
}
