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
  Select,
  useDisclosure,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Flex,
  Spacer,
  InputGroup,
  InputLeftAddon,
} from '@chakra-ui/react';
import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { useLoaderData, useActionData, Form, useNavigation, Link } from '@remix-run/react';
import { FiArrowLeft, FiSend, FiDollarSign, FiXCircle, FiDownload } from 'react-icons/fi';
import { requireAuth } from '~/lib/auth.server';
import { apiClient } from '~/lib/api.server';

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxRate?: number;
}

interface Payment {
  id: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  status: string;
  processedAt: string | null;
  createdAt: string;
}

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
  paidDate: string | null;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  currency: string;
  lineItems: LineItem[] | null;
  taxRate: number | null;
  notes: string | null;
  internalNotes: string | null;
  guestName: string | null;
  guestEmail: string | null;
  payments: Payment[];
  createdAt: string;
  updatedAt: string;
}

export async function loader({ request, params, context }: LoaderFunctionArgs) {
  const { token } = await requireAuth(request, context);
  const api = apiClient(context, token);

  const response = await api.get(`/payments/invoices/${params.id}`);

  if (!response.ok) {
    throw new Response('Invoice not found', { status: 404 });
  }

  const data = await response.json() as { invoice: Invoice };

  return json({ invoice: data.invoice });
}

export async function action({ request, params, context }: ActionFunctionArgs) {
  const { token } = await requireAuth(request, context);
  const api = apiClient(context, token);

  const formData = await request.formData();
  const intent = formData.get('intent');

  switch (intent) {
    case 'send': {
      const response = await api.post(`/payments/invoices/${params.id}/send`);
      if (!response.ok) {
        const error = await response.json() as { error?: string };
        return json({ error: error.error || 'Failed to send invoice' }, { status: 400 });
      }
      return json({ success: true, message: 'Invoice sent' });
    }

    case 'cancel': {
      const response = await api.post(`/payments/invoices/${params.id}/cancel`);
      if (!response.ok) {
        const error = await response.json() as { error?: string };
        return json({ error: error.error || 'Failed to cancel invoice' }, { status: 400 });
      }
      return redirect('/app/finances');
    }

    case 'recordPayment': {
      const paymentData = {
        invoiceId: params.id,
        amount: Math.round(parseFloat(formData.get('amount') as string) * 100),
        paymentMethod: formData.get('paymentMethod'),
        notes: formData.get('notes') || undefined,
      };

      const response = await api.post('/payments/payments', paymentData);
      if (!response.ok) {
        const error = await response.json() as { error?: string };
        return json({ error: error.error || 'Failed to record payment' }, { status: 400 });
      }
      return json({ success: true, message: 'Payment recorded' });
    }

    default:
      return json({ error: 'Invalid action' }, { status: 400 });
  }
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

export default function InvoiceDetail() {
  const { invoice } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  const paymentModal = useDisclosure();

  const isOverdue =
    invoice.dueDate < new Date().toISOString().split('T')[0] &&
    invoice.status !== 'paid' &&
    invoice.status !== 'cancelled';

  const remainingAmount = invoice.totalAmount - invoice.paidAmount;
  const canSend = invoice.status === 'draft';
  const canRecordPayment = invoice.status !== 'paid' && invoice.status !== 'cancelled' && remainingAmount > 0;
  const canCancel = invoice.status !== 'paid' && invoice.status !== 'cancelled';

  return (
    <Box maxW="4xl" mx="auto">
      <HStack mb={6}>
        <Button as={Link} to="/app/finances" variant="ghost" leftIcon={<FiArrowLeft />} size="sm">
          Back to Finances
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
          {actionData.message}
        </Alert>
      )}

      {/* Header */}
      <Flex mb={6} align="center">
        <Box>
          <HStack>
            <Heading size="lg">{invoice.invoiceNumber}</Heading>
            <Badge colorScheme={isOverdue ? 'red' : statusColors[invoice.status]} fontSize="md" px={3} py={1}>
              {isOverdue ? 'Overdue' : statusLabels[invoice.status]}
            </Badge>
          </HStack>
          <Text color="gray.600">{typeLabels[invoice.type] || invoice.type}</Text>
        </Box>
        <Spacer />
        <HStack>
          {canSend && (
            <Form method="post">
              <input type="hidden" name="intent" value="send" />
              <Button type="submit" leftIcon={<FiSend />} colorScheme="blue" isLoading={isSubmitting}>
                Send Invoice
              </Button>
            </Form>
          )}
          {canRecordPayment && (
            <Button leftIcon={<FiDollarSign />} colorScheme="green" onClick={paymentModal.onOpen}>
              Record Payment
            </Button>
          )}
          <Button leftIcon={<FiDownload />} variant="outline">
            Download PDF
          </Button>
          {canCancel && (
            <Form method="post">
              <input type="hidden" name="intent" value="cancel" />
              <Button type="submit" leftIcon={<FiXCircle />} colorScheme="red" variant="ghost" isLoading={isSubmitting}>
                Cancel
              </Button>
            </Form>
          )}
        </HStack>
      </Flex>

      <Grid templateColumns="repeat(3, 1fr)" gap={6}>
        {/* Left Column - Invoice Details */}
        <GridItem colSpan={2}>
          <VStack spacing={6} align="stretch">
            {/* Guest Info */}
            <Card>
              <CardHeader>
                <Heading size="md">Bill To</Heading>
              </CardHeader>
              <CardBody>
                <VStack align="start" spacing={1}>
                  <Text fontWeight="medium" fontSize="lg">
                    {invoice.guestName || 'Unknown Guest'}
                  </Text>
                  <Text color="gray.600">{invoice.guestEmail}</Text>
                </VStack>
              </CardBody>
            </Card>

            {/* Line Items */}
            <Card>
              <CardHeader>
                <Heading size="md">Line Items</Heading>
              </CardHeader>
              <CardBody p={0}>
                <Table>
                  <Thead>
                    <Tr>
                      <Th>Description</Th>
                      <Th isNumeric>Qty</Th>
                      <Th isNumeric>Unit Price</Th>
                      <Th isNumeric>Amount</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {(invoice.lineItems || []).map((item, index) => (
                      <Tr key={index}>
                        <Td>{item.description}</Td>
                        <Td isNumeric>{item.quantity}</Td>
                        <Td isNumeric>{formatCurrency(item.unitPrice, invoice.currency)}</Td>
                        <Td isNumeric>{formatCurrency(item.amount, invoice.currency)}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>

                <Box p={4} borderTopWidth="1px">
                  <VStack align="stretch" spacing={2}>
                    <HStack justify="space-between">
                      <Text color="gray.600">Subtotal</Text>
                      <Text>{formatCurrency(invoice.subtotal, invoice.currency)}</Text>
                    </HStack>

                    {invoice.discountAmount > 0 && (
                      <HStack justify="space-between">
                        <Text color="gray.600">Discount</Text>
                        <Text color="green.500">-{formatCurrency(invoice.discountAmount, invoice.currency)}</Text>
                      </HStack>
                    )}

                    {invoice.taxAmount > 0 && (
                      <HStack justify="space-between">
                        <Text color="gray.600">Tax {invoice.taxRate ? `(${invoice.taxRate / 100}%)` : ''}</Text>
                        <Text>{formatCurrency(invoice.taxAmount, invoice.currency)}</Text>
                      </HStack>
                    )}

                    <Divider />

                    <HStack justify="space-between">
                      <Text fontWeight="bold" fontSize="lg">
                        Total
                      </Text>
                      <Text fontWeight="bold" fontSize="lg">
                        {formatCurrency(invoice.totalAmount, invoice.currency)}
                      </Text>
                    </HStack>

                    {invoice.paidAmount > 0 && (
                      <>
                        <HStack justify="space-between">
                          <Text color="green.500">Paid</Text>
                          <Text color="green.500">-{formatCurrency(invoice.paidAmount, invoice.currency)}</Text>
                        </HStack>
                        <HStack justify="space-between">
                          <Text fontWeight="bold">Balance Due</Text>
                          <Text fontWeight="bold" color={remainingAmount > 0 ? 'red.500' : 'green.500'}>
                            {formatCurrency(remainingAmount, invoice.currency)}
                          </Text>
                        </HStack>
                      </>
                    )}
                  </VStack>
                </Box>
              </CardBody>
            </Card>

            {/* Payment History */}
            {invoice.payments.length > 0 && (
              <Card>
                <CardHeader>
                  <Heading size="md">Payment History</Heading>
                </CardHeader>
                <CardBody p={0}>
                  <Table size="sm">
                    <Thead>
                      <Tr>
                        <Th>Date</Th>
                        <Th>Method</Th>
                        <Th>Status</Th>
                        <Th isNumeric>Amount</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {invoice.payments.map((payment) => (
                        <Tr key={payment.id}>
                          <Td>{formatDate(payment.processedAt || payment.createdAt)}</Td>
                          <Td>{paymentMethodLabels[payment.paymentMethod] || payment.paymentMethod}</Td>
                          <Td>
                            <Badge colorScheme={payment.status === 'succeeded' ? 'green' : 'gray'}>
                              {payment.status}
                            </Badge>
                          </Td>
                          <Td isNumeric>{formatCurrency(payment.amount, payment.currency)}</Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </CardBody>
              </Card>
            )}

            {/* Notes */}
            {invoice.notes && (
              <Card>
                <CardHeader>
                  <Heading size="md">Notes</Heading>
                </CardHeader>
                <CardBody>
                  <Text whiteSpace="pre-wrap">{invoice.notes}</Text>
                </CardBody>
              </Card>
            )}

            {invoice.internalNotes && (
              <Card borderColor="yellow.200" borderWidth="2px">
                <CardHeader>
                  <Heading size="md">Internal Notes</Heading>
                </CardHeader>
                <CardBody>
                  <Text whiteSpace="pre-wrap">{invoice.internalNotes}</Text>
                </CardBody>
              </Card>
            )}
          </VStack>
        </GridItem>

        {/* Right Column - Summary */}
        <GridItem>
          <VStack spacing={6} align="stretch">
            <Card>
              <CardHeader>
                <Heading size="md">Summary</Heading>
              </CardHeader>
              <CardBody>
                <VStack spacing={4} align="stretch">
                  <Box>
                    <Text fontSize="sm" color="gray.500">
                      Issue Date
                    </Text>
                    <Text>{formatDate(invoice.issueDate)}</Text>
                  </Box>

                  <Box>
                    <Text fontSize="sm" color="gray.500">
                      Due Date
                    </Text>
                    <Text color={isOverdue ? 'red.500' : undefined}>{formatDate(invoice.dueDate)}</Text>
                  </Box>

                  {invoice.paidDate && (
                    <Box>
                      <Text fontSize="sm" color="gray.500">
                        Paid Date
                      </Text>
                      <Text color="green.500">{formatDate(invoice.paidDate)}</Text>
                    </Box>
                  )}

                  <Divider />

                  <Box>
                    <Text fontSize="sm" color="gray.500">
                      Total Amount
                    </Text>
                    <Text fontSize="2xl" fontWeight="bold">
                      {formatCurrency(invoice.totalAmount, invoice.currency)}
                    </Text>
                  </Box>

                  {remainingAmount > 0 && (
                    <Box>
                      <Text fontSize="sm" color="gray.500">
                        Balance Due
                      </Text>
                      <Text fontSize="xl" fontWeight="bold" color="red.500">
                        {formatCurrency(remainingAmount, invoice.currency)}
                      </Text>
                    </Box>
                  )}
                </VStack>
              </CardBody>
            </Card>

            {/* Links */}
            <Card>
              <CardBody>
                <VStack spacing={2} align="stretch">
                  {invoice.bookingId && (
                    <HStack justify="space-between">
                      <Text fontSize="sm" color="gray.500">
                        Booking
                      </Text>
                      <Button as={Link} to={`/app/bookings/${invoice.bookingId}`} size="xs" variant="link">
                        View
                      </Button>
                    </HStack>
                  )}
                  {invoice.leaseId && (
                    <HStack justify="space-between">
                      <Text fontSize="sm" color="gray.500">
                        Lease
                      </Text>
                      <Button as={Link} to={`/app/leases/${invoice.leaseId}`} size="xs" variant="link">
                        View
                      </Button>
                    </HStack>
                  )}
                  <HStack justify="space-between">
                    <Text fontSize="sm" color="gray.500">
                      Created
                    </Text>
                    <Text fontSize="sm">{formatDate(invoice.createdAt)}</Text>
                  </HStack>
                </VStack>
              </CardBody>
            </Card>
          </VStack>
        </GridItem>
      </Grid>

      {/* Record Payment Modal */}
      <Modal isOpen={paymentModal.isOpen} onClose={paymentModal.onClose}>
        <ModalOverlay />
        <ModalContent>
          <Form method="post">
            <input type="hidden" name="intent" value="recordPayment" />
            <ModalHeader>Record Payment</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <VStack spacing={4}>
                <FormControl isRequired>
                  <FormLabel>Amount</FormLabel>
                  <InputGroup>
                    <InputLeftAddon>£</InputLeftAddon>
                    <Input
                      name="amount"
                      type="number"
                      step="0.01"
                      defaultValue={(remainingAmount / 100).toFixed(2)}
                      max={(remainingAmount / 100).toFixed(2)}
                    />
                  </InputGroup>
                  <Text fontSize="sm" color="gray.500" mt={1}>
                    Balance due: {formatCurrency(remainingAmount, invoice.currency)}
                  </Text>
                </FormControl>

                <FormControl isRequired>
                  <FormLabel>Payment Method</FormLabel>
                  <Select name="paymentMethod" defaultValue="bank_transfer">
                    <option value="card">Card</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cash">Cash</option>
                    <option value="check">Check</option>
                    <option value="other">Other</option>
                  </Select>
                </FormControl>

                <FormControl>
                  <FormLabel>Notes</FormLabel>
                  <Input name="notes" placeholder="Optional notes..." />
                </FormControl>
              </VStack>
            </ModalBody>
            <ModalFooter>
              <HStack spacing={3}>
                <Button variant="ghost" onClick={paymentModal.onClose}>
                  Cancel
                </Button>
                <Button type="submit" colorScheme="green" isLoading={isSubmitting}>
                  Record Payment
                </Button>
              </HStack>
            </ModalFooter>
          </Form>
        </ModalContent>
      </Modal>
    </Box>
  );
}
