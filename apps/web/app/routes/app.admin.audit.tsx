import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardBody,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Text,
  Select,
  HStack,
  Spinner,
  Alert,
  AlertIcon,
  VStack,
  Code,
  Collapse,
  IconButton,
  useDisclosure,
} from '@chakra-ui/react';
import { FiChevronDown, FiChevronRight } from 'react-icons/fi';
import { api } from '../lib/api';
import { formatDate, formatDateTime } from '../utils/format';

interface AuditLog {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  userId: string;
  userEmail: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: any;
  createdAt: string;
}

export default function AdminAudit() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState('');
  const [resource, setResource] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  useEffect(() => {
    loadLogs();
  }, [action, resource]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      setError(null);

      const params: any = {};
      if (action) params.action = action;
      if (resource) params.resource = resource;

      const response = await api.admin.getAuditLogs(params);
      setLogs(response.logs || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action: string): string => {
    if (action.startsWith('create')) return 'green';
    if (action.startsWith('update')) return 'blue';
    if (action.startsWith('delete')) return 'red';
    if (action.startsWith('login') || action.startsWith('logout')) return 'purple';
    return 'gray';
  };

  const toggleRow = (id: string) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  return (
    <VStack spacing={6} align="stretch">
      {/* Filters */}
      <Card>
        <CardBody>
          <HStack spacing={4}>
            <Select
              placeholder="All Actions"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              maxW="250px"
            >
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="delete">Delete</option>
              <option value="login">Login</option>
              <option value="logout">Logout</option>
            </Select>

            <Select
              placeholder="All Resources"
              value={resource}
              onChange={(e) => setResource(e.target.value)}
              maxW="250px"
            >
              <option value="property">Properties</option>
              <option value="unit">Units</option>
              <option value="booking">Bookings</option>
              <option value="lease">Leases</option>
              <option value="payment">Payments</option>
              <option value="user">Users</option>
              <option value="settings">Settings</option>
            </Select>
          </HStack>
        </CardBody>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert status="error">
          <AlertIcon />
          {error}
        </Alert>
      )}

      {/* Audit Logs Table */}
      <Card>
        <CardBody p={0}>
          {loading ? (
            <Box display="flex" justifyContent="center" py={10}>
              <Spinner size="xl" color="brand.500" />
            </Box>
          ) : logs.length === 0 ? (
            <Box py={10} textAlign="center">
              <Text color="gray.500">No audit logs found</Text>
            </Box>
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th width="50px"></Th>
                  <Th>Timestamp</Th>
                  <Th>Action</Th>
                  <Th>Resource</Th>
                  <Th>User</Th>
                  <Th>IP Address</Th>
                </Tr>
              </Thead>
              <Tbody>
                {logs.map((log) => (
                  <>
                    <Tr key={log.id} _hover={{ bg: 'gray.50' }}>
                      <Td>
                        <IconButton
                          icon={expandedRow === log.id ? <FiChevronDown /> : <FiChevronRight />}
                          variant="ghost"
                          size="sm"
                          aria-label="Expand"
                          onClick={() => toggleRow(log.id)}
                        />
                      </Td>
                      <Td>
                        <Text fontSize="sm">{formatDateTime(log.createdAt)}</Text>
                      </Td>
                      <Td>
                        <Badge colorScheme={getActionColor(log.action)}>{log.action}</Badge>
                      </Td>
                      <Td>
                        <VStack align="start" spacing={0}>
                          <Text fontSize="sm" fontWeight="medium">{log.resource}</Text>
                          {log.resourceId && (
                            <Text fontSize="xs" color="gray.500">{log.resourceId}</Text>
                          )}
                        </VStack>
                      </Td>
                      <Td>
                        <VStack align="start" spacing={0}>
                          <Text fontSize="sm">{log.userEmail || 'Unknown'}</Text>
                          <Text fontSize="xs" color="gray.500">{log.userId}</Text>
                        </VStack>
                      </Td>
                      <Td>
                        <Text fontSize="sm">{log.ipAddress || '-'}</Text>
                      </Td>
                    </Tr>
                    <Tr key={`${log.id}-details`}>
                      <Td colSpan={6} p={0} borderBottom="none">
                        <Collapse in={expandedRow === log.id}>
                          <Box p={4} bg="gray.50">
                            <VStack align="stretch" spacing={3}>
                              {log.userAgent && (
                                <Box>
                                  <Text fontSize="sm" fontWeight="medium" mb={1}>User Agent:</Text>
                                  <Text fontSize="sm" color="gray.600">{log.userAgent}</Text>
                                </Box>
                              )}
                              {log.metadata && Object.keys(log.metadata).length > 0 && (
                                <Box>
                                  <Text fontSize="sm" fontWeight="medium" mb={1}>Metadata:</Text>
                                  <Code display="block" p={3} rounded="md" fontSize="xs" whiteSpace="pre">
                                    {JSON.stringify(log.metadata, null, 2)}
                                  </Code>
                                </Box>
                              )}
                            </VStack>
                          </Box>
                        </Collapse>
                      </Td>
                    </Tr>
                  </>
                ))}
              </Tbody>
            </Table>
          )}
        </CardBody>
      </Card>

      {logs.length > 0 && (
        <Text fontSize="sm" color="gray.500">
          Showing {logs.length} audit logs
        </Text>
      )}
    </VStack>
  );
}
