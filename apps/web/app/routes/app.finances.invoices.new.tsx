import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  FormControl,
  FormLabel,
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
  IconButton,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  InputGroup,
  InputLeftAddon,
} from '@chakra-ui/react';
import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { useLoaderData, useActionData, Form, useNavigation, Link } from '@remix-run/react';
import { useState } from 'react';
import { FiArrowLeft, FiPlus, FiTrash2 } from 'react-icons/fi';
import { requireAuth } from '~/lib/auth.server';
import { apiClient } from '~/lib/api.server';

interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { token } = await requireAuth(request, context);
  const api = apiClient(context, token);

  // Load guests for selection (from bookings guests endpoint)
  // For now, we'll return an empty array - in a full implementation,
  // there would be a guests endpoint
  const guests: Guest[] = [];

  return json({ guests });
}

export async function action({ request, context }: ActionFunctionArgs) {
  const { token } = await requireAuth(request, context);
  const api = apiClient(context, token);

  const formData = await request.formData();

  // Parse line items from form
  const lineItemsJson = formData.get('lineItems');
  let lineItems: LineItem[] = [];
  try {
    lineItems = JSON.parse(lineItemsJson as string);
  } catch {
    return json({ error: 'Invalid line items' }, { status: 400 });
  }

  const invoiceData = {
    guestId: formData.get('guestId'),
    type: formData.get('type'),
    issueDate: formData.get('issueDate'),
    dueDate: formData.get('dueDate'),
    lineItems,
    taxRate: formData.get('taxRate') ? parseInt(formData.get('taxRate') as string) * 100 : undefined,
    discountAmount: formData.get('discountAmount') ? Math.round(parseFloat(formData.get('discountAmount') as string) * 100) : undefined,
    currency: formData.get('currency') || 'GBP',
    notes: formData.get('notes') || undefined,
    internalNotes: formData.get('internalNotes') || undefined,
    bookingId: formData.get('bookingId') || undefined,
    leaseId: formData.get('leaseId') || undefined,
  };

  const response = await api.post('/payments/invoices', invoiceData);

  if (!response.ok) {
    const error = await response.json() as { error?: string };
    return json({ error: error.error || 'Failed to create invoice' }, { status: 400 });
  }

  const result = await response.json() as { invoice: { id: string } };
  return redirect(`/app/finances/invoices/${result.invoice.id}`);
}

export default function NewInvoice() {
  const { guests } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  // Default dates
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Line items state
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: '', quantity: 1, unitPrice: 0, amount: 0 },
  ]);

  const addLineItem = () => {
    setLineItems([...lineItems, { description: '', quantity: 1, unitPrice: 0, amount: 0 }]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string | number) => {
    const updated = [...lineItems];
    if (field === 'description') {
      updated[index].description = value as string;
    } else if (field === 'quantity') {
      updated[index].quantity = Math.max(1, parseInt(value as string) || 1);
      updated[index].amount = updated[index].quantity * updated[index].unitPrice;
    } else if (field === 'unitPrice') {
      updated[index].unitPrice = Math.round(parseFloat(value as string) * 100) || 0;
      updated[index].amount = updated[index].quantity * updated[index].unitPrice;
    }
    setLineItems(updated);
  };

  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);

  return (
    <Box maxW="4xl" mx="auto">
      <HStack mb={6}>
        <Button as={Link} to="/app/finances" variant="ghost" leftIcon={<FiArrowLeft />} size="sm">
          Back to Finances
        </Button>
      </HStack>

      <Heading size="lg" mb={6}>
        New Invoice
      </Heading>

      {actionData?.error && (
        <Alert status="error" mb={6}>
          <AlertIcon />
          {actionData.error}
        </Alert>
      )}

      <Form method="post">
        <input type="hidden" name="lineItems" value={JSON.stringify(lineItems)} />

        <VStack spacing={6} align="stretch">
          {/* Invoice Details */}
          <Card>
            <CardHeader>
              <Heading size="md">Invoice Details</Heading>
            </CardHeader>
            <CardBody>
              <VStack spacing={4}>
                <Grid templateColumns="repeat(2, 1fr)" gap={4} w="full">
                  <GridItem>
                    <FormControl isRequired>
                      <FormLabel>Guest ID</FormLabel>
                      <Input name="guestId" placeholder="Enter guest ID" />
                      <Text fontSize="sm" color="gray.500" mt={1}>
                        Guest must already exist in the system
                      </Text>
                    </FormControl>
                  </GridItem>
                  <GridItem>
                    <FormControl isRequired>
                      <FormLabel>Invoice Type</FormLabel>
                      <Select name="type" defaultValue="booking">
                        <option value="booking">Booking</option>
                        <option value="rent">Rent</option>
                        <option value="deposit">Deposit</option>
                        <option value="cleaning">Cleaning</option>
                        <option value="damage">Damage</option>
                        <option value="other">Other</option>
                      </Select>
                    </FormControl>
                  </GridItem>
                </Grid>

                <Grid templateColumns="repeat(3, 1fr)" gap={4} w="full">
                  <GridItem>
                    <FormControl isRequired>
                      <FormLabel>Issue Date</FormLabel>
                      <Input name="issueDate" type="date" defaultValue={today} />
                    </FormControl>
                  </GridItem>
                  <GridItem>
                    <FormControl isRequired>
                      <FormLabel>Due Date</FormLabel>
                      <Input name="dueDate" type="date" defaultValue={thirtyDaysLater} />
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
                    <FormControl>
                      <FormLabel>Booking ID (Optional)</FormLabel>
                      <Input name="bookingId" placeholder="Link to booking" />
                    </FormControl>
                  </GridItem>
                  <GridItem>
                    <FormControl>
                      <FormLabel>Lease ID (Optional)</FormLabel>
                      <Input name="leaseId" placeholder="Link to lease" />
                    </FormControl>
                  </GridItem>
                </Grid>
              </VStack>
            </CardBody>
          </Card>

          {/* Line Items */}
          <Card>
            <CardHeader>
              <HStack justify="space-between">
                <Heading size="md">Line Items</Heading>
                <Button leftIcon={<FiPlus />} size="sm" onClick={addLineItem}>
                  Add Item
                </Button>
              </HStack>
            </CardHeader>
            <CardBody p={0}>
              <Table size="sm">
                <Thead>
                  <Tr>
                    <Th>Description</Th>
                    <Th w="100px">Qty</Th>
                    <Th w="150px">Unit Price</Th>
                    <Th w="150px">Amount</Th>
                    <Th w="50px"></Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {lineItems.map((item, index) => (
                    <Tr key={index}>
                      <Td>
                        <Input
                          size="sm"
                          value={item.description}
                          onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                          placeholder="Item description"
                        />
                      </Td>
                      <Td>
                        <Input
                          size="sm"
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => updateLineItem(index, 'quantity', e.target.value)}
                        />
                      </Td>
                      <Td>
                        <InputGroup size="sm">
                          <InputLeftAddon>£</InputLeftAddon>
                          <Input
                            type="number"
                            step="0.01"
                            value={(item.unitPrice / 100).toFixed(2)}
                            onChange={(e) => updateLineItem(index, 'unitPrice', e.target.value)}
                          />
                        </InputGroup>
                      </Td>
                      <Td>
                        <Text fontWeight="medium">£{(item.amount / 100).toFixed(2)}</Text>
                      </Td>
                      <Td>
                        <IconButton
                          aria-label="Remove item"
                          icon={<FiTrash2 />}
                          size="sm"
                          variant="ghost"
                          colorScheme="red"
                          isDisabled={lineItems.length === 1}
                          onClick={() => removeLineItem(index)}
                        />
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>

              <Box p={4} borderTopWidth="1px">
                <HStack justify="flex-end">
                  <Text fontWeight="medium">Subtotal:</Text>
                  <Text fontWeight="bold" fontSize="lg">
                    £{(subtotal / 100).toFixed(2)}
                  </Text>
                </HStack>
              </Box>
            </CardBody>
          </Card>

          {/* Tax & Discount */}
          <Card>
            <CardHeader>
              <Heading size="md">Tax & Discount</Heading>
            </CardHeader>
            <CardBody>
              <Grid templateColumns="repeat(2, 1fr)" gap={4}>
                <GridItem>
                  <FormControl>
                    <FormLabel>Tax Rate (%)</FormLabel>
                    <Input name="taxRate" type="number" min={0} max={100} placeholder="e.g., 20" />
                  </FormControl>
                </GridItem>
                <GridItem>
                  <FormControl>
                    <FormLabel>Discount Amount</FormLabel>
                    <InputGroup>
                      <InputLeftAddon>£</InputLeftAddon>
                      <Input name="discountAmount" type="number" step="0.01" placeholder="0.00" />
                    </InputGroup>
                  </FormControl>
                </GridItem>
              </Grid>
            </CardBody>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <Heading size="md">Notes</Heading>
            </CardHeader>
            <CardBody>
              <VStack spacing={4}>
                <FormControl>
                  <FormLabel>Notes (visible to guest)</FormLabel>
                  <Textarea name="notes" placeholder="Payment terms, thank you message, etc." rows={2} />
                </FormControl>

                <FormControl>
                  <FormLabel>Internal Notes</FormLabel>
                  <Textarea name="internalNotes" placeholder="Notes for internal use only..." rows={2} />
                </FormControl>
              </VStack>
            </CardBody>
          </Card>

          {/* Submit */}
          <HStack justify="flex-end" spacing={4}>
            <Button as={Link} to="/app/finances" variant="ghost">
              Cancel
            </Button>
            <Button type="submit" colorScheme="brand" isLoading={isSubmitting}>
              Create Invoice
            </Button>
          </HStack>
        </VStack>
      </Form>
    </Box>
  );
}
