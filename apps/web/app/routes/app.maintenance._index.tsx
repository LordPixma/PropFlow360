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
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
} from '@chakra-ui/react';
import { json, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { useLoaderData, useNavigate, useSearchParams, Form, Link } from '@remix-run/react';
import { FiPlus, FiMoreVertical, FiEye, FiEdit, FiUserPlus } from 'react-icons/fi';
import { requireAuth } from '~/lib/auth.server';
import { apiClient } from '~/lib/api.server';

interface MaintenanceTicket {
  id: string;
  ticketNumber: string;
  propertyId: string;
  propertyName: string | null;
  unitId: string | null;
  unitName: string | null;
  title: string;
  category: string;
  priority: string;
  status: string;
  assignedToVendorId: string | null;
  vendorName: string | null;
  scheduledDate: string | null;
  dueDate: string | null;
  estimatedCost: number | null;
  currency: string;
  createdAt: string;
}

interface Vendor {
  id: string;
  name: string;
  type: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  rating: number | null;
  hourlyRate: number | null;
  currency: string;
  createdAt: string;
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { token } = await requireAuth(request, context);
  const api = apiClient(context, token);

  const url = new URL(request.url);
  const tab = url.searchParams.get('tab') || 'tickets';

  // Fetch maintenance tickets
  const ticketsParams = new URLSearchParams();
  const status = url.searchParams.get('status');
  if (status) ticketsParams.set('status', status);
  ticketsParams.set('pageSize', '20');

  const ticketsResponse = await api.get(`/maintenance?${ticketsParams.toString()}`);
  const ticketsData = ticketsResponse.ok
    ? ((await ticketsResponse.json()) as { tickets: MaintenanceTicket[]; total: number })
    : { tickets: [], total: 0 };

  // Fetch vendors
  const vendorsResponse = await api.get('/vendors?pageSize=50');
  const vendorsData = vendorsResponse.ok
    ? ((await vendorsResponse.json()) as { vendors: Vendor[]; total: number })
    : { vendors: [], total: 0 };

  return json({
    tickets: ticketsData.tickets,
    ticketsTotal: ticketsData.total,
    vendors: vendorsData.vendors,
    vendorsTotal: vendorsData.total,
    tab,
  });
}

const statusColors: Record<string, string> = {
  open: 'blue',
  assigned: 'purple',
  in_progress: 'yellow',
  on_hold: 'orange',
  resolved: 'green',
  closed: 'gray',
};

const priorityColors: Record<string, string> = {
  low: 'gray',
  medium: 'blue',
  high: 'orange',
  urgent: 'red',
};

const categoryLabels: Record<string, string> = {
  plumbing: 'Plumbing',
  electrical: 'Electrical',
  hvac: 'HVAC',
  appliance: 'Appliance',
  structural: 'Structural',
  pest: 'Pest',
  other: 'Other',
};

const vendorTypeLabels: Record<string, string> = {
  cleaning: 'Cleaning',
  maintenance: 'Maintenance',
  plumbing: 'Plumbing',
  electrical: 'Electrical',
  landscaping: 'Landscaping',
  other: 'Other',
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
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount / 100);
}

export default function MaintenanceIndex() {
  const { tickets, vendors, tab } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const tabIndex = tab === 'vendors' ? 1 : 0;

  return (
    <Box>
      <Flex mb={6} align="center">
        <Box>
          <Heading size="lg">Maintenance</Heading>
          <Text color="gray.600" mt={1}>
            Manage maintenance tickets and vendors
          </Text>
        </Box>
        <Spacer />
        <HStack>
          <Button as={Link} to="/app/maintenance/tickets/new" leftIcon={<FiPlus />} colorScheme="brand">
            New Ticket
          </Button>
          <Button as={Link} to="/app/maintenance/vendors/new" leftIcon={<FiUserPlus />} variant="outline">
            Add Vendor
          </Button>
        </HStack>
      </Flex>

      <Card>
        <Tabs index={tabIndex} onChange={(index) => navigate(`?tab=${index === 1 ? 'vendors' : 'tickets'}`)}>
          <TabList px={4} pt={4}>
            <Tab>Tickets</Tab>
            <Tab>Vendors</Tab>
          </TabList>

          <TabPanels>
            {/* Tickets Tab */}
            <TabPanel p={0}>
              {/* Filters */}
              <Box px={4} py={3} borderBottomWidth="1px">
                <Form method="get">
                  <input type="hidden" name="tab" value="tickets" />
                  <HStack spacing={4}>
                    <Select
                      name="status"
                      placeholder="All Statuses"
                      defaultValue={searchParams.get('status') || ''}
                      w="200px"
                    >
                      <option value="open">Open</option>
                      <option value="assigned">Assigned</option>
                      <option value="in_progress">In Progress</option>
                      <option value="on_hold">On Hold</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </Select>
                    <Button type="submit" colorScheme="brand" variant="outline" size="sm">
                      Filter
                    </Button>
                    {searchParams.get('status') && (
                      <Button variant="ghost" size="sm" onClick={() => navigate('/app/maintenance')}>
                        Clear
                      </Button>
                    )}
                  </HStack>
                </Form>
              </Box>

              <CardBody p={0}>
                {tickets.length === 0 ? (
                  <VStack py={12} spacing={4}>
                    <Text color="gray.500">No maintenance tickets</Text>
                    <Button
                      as={Link}
                      to="/app/maintenance/tickets/new"
                      leftIcon={<FiPlus />}
                      colorScheme="brand"
                      size="sm"
                    >
                      Create First Ticket
                    </Button>
                  </VStack>
                ) : (
                  <Table>
                    <Thead>
                      <Tr>
                        <Th>Ticket #</Th>
                        <Th>Property / Unit</Th>
                        <Th>Issue</Th>
                        <Th>Category</Th>
                        <Th>Priority</Th>
                        <Th>Assigned To</Th>
                        <Th>Status</Th>
                        <Th w="50px"></Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {tickets.map((ticket) => (
                        <Tr
                          key={ticket.id}
                          _hover={{ bg: 'gray.50' }}
                          cursor="pointer"
                          onClick={() => navigate(`/app/maintenance/tickets/${ticket.id}`)}
                        >
                          <Td>
                            <Text fontWeight="medium">{ticket.ticketNumber}</Text>
                          </Td>
                          <Td>
                            <VStack align="start" spacing={0}>
                              <Text fontSize="sm">{ticket.propertyName || 'Unknown'}</Text>
                              {ticket.unitName && (
                                <Text fontSize="sm" color="gray.500">
                                  {ticket.unitName}
                                </Text>
                              )}
                            </VStack>
                          </Td>
                          <Td>
                            <Text fontSize="sm" noOfLines={1}>
                              {ticket.title}
                            </Text>
                          </Td>
                          <Td>
                            <Text fontSize="sm">{categoryLabels[ticket.category] || ticket.category}</Text>
                          </Td>
                          <Td>
                            <Badge colorScheme={priorityColors[ticket.priority]} size="sm">
                              {ticket.priority.toUpperCase()}
                            </Badge>
                          </Td>
                          <Td>
                            <Text fontSize="sm">{ticket.vendorName || 'Unassigned'}</Text>
                          </Td>
                          <Td>
                            <Badge colorScheme={statusColors[ticket.status]}>
                              {ticket.status.replace(/_/g, ' ')}
                            </Badge>
                          </Td>
                          <Td onClick={(e) => e.stopPropagation()}>
                            <Menu>
                              <MenuButton as={IconButton} icon={<FiMoreVertical />} variant="ghost" size="sm" />
                              <MenuList>
                                <MenuItem
                                  icon={<FiEye />}
                                  onClick={() => navigate(`/app/maintenance/tickets/${ticket.id}`)}
                                >
                                  View Details
                                </MenuItem>
                                <MenuItem icon={<FiEdit />}>Edit</MenuItem>
                                {!ticket.assignedToVendorId && <MenuItem>Assign Vendor</MenuItem>}
                              </MenuList>
                            </Menu>
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                )}
              </CardBody>
            </TabPanel>

            {/* Vendors Tab */}
            <TabPanel p={0}>
              <CardBody p={0}>
                {vendors.length === 0 ? (
                  <VStack py={12} spacing={4}>
                    <Text color="gray.500">No vendors added yet</Text>
                    <Button
                      as={Link}
                      to="/app/maintenance/vendors/new"
                      leftIcon={<FiUserPlus />}
                      colorScheme="brand"
                      size="sm"
                    >
                      Add First Vendor
                    </Button>
                  </VStack>
                ) : (
                  <Table>
                    <Thead>
                      <Tr>
                        <Th>Name</Th>
                        <Th>Type</Th>
                        <Th>Contact</Th>
                        <Th>Hourly Rate</Th>
                        <Th>Rating</Th>
                        <Th>Status</Th>
                        <Th w="50px"></Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {vendors.map((vendor) => (
                        <Tr
                          key={vendor.id}
                          _hover={{ bg: 'gray.50' }}
                          cursor="pointer"
                          onClick={() => navigate(`/app/maintenance/vendors/${vendor.id}`)}
                        >
                          <Td>
                            <VStack align="start" spacing={0}>
                              <Text fontWeight="medium">{vendor.name}</Text>
                              {vendor.company && (
                                <Text fontSize="sm" color="gray.500">
                                  {vendor.company}
                                </Text>
                              )}
                            </VStack>
                          </Td>
                          <Td>
                            <Text fontSize="sm">{vendorTypeLabels[vendor.type] || vendor.type}</Text>
                          </Td>
                          <Td>
                            <VStack align="start" spacing={0}>
                              {vendor.email && (
                                <Text fontSize="sm" color="gray.600">
                                  {vendor.email}
                                </Text>
                              )}
                              {vendor.phone && (
                                <Text fontSize="sm" color="gray.500">
                                  {vendor.phone}
                                </Text>
                              )}
                            </VStack>
                          </Td>
                          <Td>
                            {vendor.hourlyRate ? (
                              <Text fontSize="sm">{formatCurrency(vendor.hourlyRate, vendor.currency)}/hr</Text>
                            ) : (
                              <Text fontSize="sm" color="gray.400">
                                Not set
                              </Text>
                            )}
                          </Td>
                          <Td>
                            {vendor.rating ? (
                              <Text fontSize="sm">⭐ {(vendor.rating / 100).toFixed(1)}</Text>
                            ) : (
                              <Text fontSize="sm" color="gray.400">
                                No rating
                              </Text>
                            )}
                          </Td>
                          <Td>
                            <Badge colorScheme={vendor.status === 'active' ? 'green' : 'gray'}>
                              {vendor.status}
                            </Badge>
                          </Td>
                          <Td onClick={(e) => e.stopPropagation()}>
                            <Menu>
                              <MenuButton as={IconButton} icon={<FiMoreVertical />} variant="ghost" size="sm" />
                              <MenuList>
                                <MenuItem
                                  icon={<FiEye />}
                                  onClick={() => navigate(`/app/maintenance/vendors/${vendor.id}`)}
                                >
                                  View Details
                                </MenuItem>
                                <MenuItem icon={<FiEdit />}>Edit</MenuItem>
                                <MenuItem>{vendor.status === 'active' ? 'Deactivate' : 'Activate'}</MenuItem>
                              </MenuList>
                            </Menu>
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
