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
  Input,
  Select,
  VStack,
  Flex,
  Spacer,
} from '@chakra-ui/react';
import { json, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { useLoaderData, useNavigate, useSearchParams, Form, Link } from '@remix-run/react';
import { FiPlus, FiMoreVertical, FiEye, FiEdit, FiXCircle } from 'react-icons/fi';
import { requireAuth } from '~/lib/auth.server';
import { apiClient } from '~/lib/api.server';

interface Lease {
  id: string;
  unitId: string;
  unitName: string;
  propertyName: string;
  guestId: string;
  guestName: string;
  guestEmail: string;
  status: string;
  leaseType: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  deposit: number | null;
  currency: string;
  primaryOccupant: string;
  createdAt: string;
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { token } = await requireAuth(request, context);

  const url = new URL(request.url);
  const params = new URLSearchParams();

  const status = url.searchParams.get('status');
  const unitId = url.searchParams.get('unitId');
  const page = url.searchParams.get('page') || '1';

  if (status) params.set('status', status);
  if (unitId) params.set('unitId', unitId);
  params.set('page', page);
  params.set('pageSize', '20');

  const api = apiClient(context, token);
  const response = await api.get(`/leases?${params.toString()}`);

  if (!response.ok) {
    throw new Error('Failed to load leases');
  }

  const data = await response.json() as { leases: Lease[]; total: number; page: number; pageSize: number };

  return json({
    leases: data.leases,
    total: data.total,
    page: data.page,
    pageSize: data.pageSize,
  });
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

export default function LeasesIndex() {
  const { leases, total, page, pageSize } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const totalPages = Math.ceil(total / pageSize);

  return (
    <Box>
      <Flex mb={6} align="center">
        <Box>
          <Heading size="lg">Leases</Heading>
          <Text color="gray.600" mt={1}>
            Manage long-term rental agreements
          </Text>
        </Box>
        <Spacer />
        <Button
          as={Link}
          to="/app/leases/new"
          leftIcon={<FiPlus />}
          colorScheme="brand"
        >
          New Lease
        </Button>
      </Flex>

      {/* Filters */}
      <Card mb={6}>
        <CardBody>
          <Form method="get">
            <HStack spacing={4} wrap="wrap">
              <Select
                name="status"
                placeholder="All Statuses"
                defaultValue={searchParams.get('status') || ''}
                w="200px"
              >
                <option value="draft">Draft</option>
                <option value="pending_signature">Pending Signature</option>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="terminated">Terminated</option>
                <option value="renewed">Renewed</option>
              </Select>

              <Button type="submit" colorScheme="brand" variant="outline">
                Filter
              </Button>

              {(searchParams.get('status')) && (
                <Button
                  variant="ghost"
                  onClick={() => navigate('/app/leases')}
                >
                  Clear
                </Button>
              )}
            </HStack>
          </Form>
        </CardBody>
      </Card>

      {/* Leases Table */}
      <Card>
        <CardBody p={0}>
          {leases.length === 0 ? (
            <VStack py={12} spacing={4}>
              <Text color="gray.500">No leases found</Text>
              <Button
                as={Link}
                to="/app/leases/new"
                leftIcon={<FiPlus />}
                colorScheme="brand"
                size="sm"
              >
                Create First Lease
              </Button>
            </VStack>
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Property / Unit</Th>
                  <Th>Tenant</Th>
                  <Th>Type</Th>
                  <Th>Term</Th>
                  <Th>Rent</Th>
                  <Th>Status</Th>
                  <Th w="50px"></Th>
                </Tr>
              </Thead>
              <Tbody>
                {leases.map((lease) => (
                  <Tr
                    key={lease.id}
                    _hover={{ bg: 'gray.50' }}
                    cursor="pointer"
                    onClick={() => navigate(`/app/leases/${lease.id}`)}
                  >
                    <Td>
                      <VStack align="start" spacing={0}>
                        <Text fontWeight="medium">{lease.unitName}</Text>
                        <Text fontSize="sm" color="gray.500">
                          {lease.propertyName}
                        </Text>
                      </VStack>
                    </Td>
                    <Td>
                      <VStack align="start" spacing={0}>
                        <Text fontWeight="medium">{lease.guestName}</Text>
                        <Text fontSize="sm" color="gray.500">
                          {lease.guestEmail}
                        </Text>
                      </VStack>
                    </Td>
                    <Td>
                      <Text fontSize="sm">
                        {leaseTypeLabels[lease.leaseType] || lease.leaseType}
                      </Text>
                    </Td>
                    <Td>
                      <VStack align="start" spacing={0}>
                        <Text fontSize="sm">{formatDate(lease.startDate)}</Text>
                        <Text fontSize="sm" color="gray.500">
                          to {formatDate(lease.endDate)}
                        </Text>
                      </VStack>
                    </Td>
                    <Td>
                      <Text fontWeight="medium">
                        {formatCurrency(lease.monthlyRent, lease.currency)}/mo
                      </Text>
                    </Td>
                    <Td>
                      <Badge colorScheme={statusColors[lease.status] || 'gray'}>
                        {statusLabels[lease.status] || lease.status}
                      </Badge>
                    </Td>
                    <Td onClick={(e) => e.stopPropagation()}>
                      <Menu>
                        <MenuButton
                          as={IconButton}
                          icon={<FiMoreVertical />}
                          variant="ghost"
                          size="sm"
                        />
                        <MenuList>
                          <MenuItem
                            icon={<FiEye />}
                            onClick={() => navigate(`/app/leases/${lease.id}`)}
                          >
                            View Details
                          </MenuItem>
                          <MenuItem
                            icon={<FiEdit />}
                            onClick={() => navigate(`/app/leases/${lease.id}/edit`)}
                          >
                            Edit
                          </MenuItem>
                          {lease.status === 'active' && (
                            <MenuItem
                              icon={<FiXCircle />}
                              color="red.500"
                              onClick={() => navigate(`/app/leases/${lease.id}?action=terminate`)}
                            >
                              Terminate
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

      {/* Pagination */}
      {totalPages > 1 && (
        <HStack justify="center" mt={6}>
          <Button
            size="sm"
            isDisabled={page <= 1}
            onClick={() => {
              const params = new URLSearchParams(searchParams);
              params.set('page', String(page - 1));
              navigate(`?${params.toString()}`);
            }}
          >
            Previous
          </Button>
          <Text>
            Page {page} of {totalPages}
          </Text>
          <Button
            size="sm"
            isDisabled={page >= totalPages}
            onClick={() => {
              const params = new URLSearchParams(searchParams);
              params.set('page', String(page + 1));
              navigate(`?${params.toString()}`);
            }}
          >
            Next
          </Button>
        </HStack>
      )}
    </Box>
  );
}
