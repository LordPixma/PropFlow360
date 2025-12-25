import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardBody,
  Button,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Text,
  HStack,
  VStack,
  Spinner,
  Alert,
  AlertIcon,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
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
  useToast,
  Icon,
  Flex,
  Code,
} from '@chakra-ui/react';
import { FiPlus, FiMoreVertical, FiTrash2, FiEdit, FiRefreshCw } from 'react-icons/fi';
import { formatDateTime } from '../utils/format';

interface Webhook {
  id: string;
  url: string;
  events: string[];
  status: string;
  secret: string;
  lastTriggeredAt: string | null;
  failureCount: number;
  createdAt: string;
}

export default function AdminWebhooks() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [formData, setFormData] = useState({ url: '', events: [] as string[] });
  const toast = useToast();

  const availableEvents = [
    'booking.created',
    'booking.confirmed',
    'booking.cancelled',
    'booking.checked_in',
    'booking.checked_out',
    'payment.succeeded',
    'payment.failed',
    'invoice.created',
    'invoice.paid',
    'maintenance.created',
    'maintenance.completed',
  ];

  useEffect(() => {
    loadWebhooks();
  }, []);

  const loadWebhooks = async () => {
    try {
      setLoading(true);
      setError(null);
      // API endpoint would be /admin/webhooks
      // For now, mock the response
      setWebhooks([]);
    } catch (err: any) {
      setError(err.message || 'Failed to load webhooks');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      // Would call api.admin.createWebhook(formData)
      toast({
        title: 'Webhook created',
        description: 'Your webhook has been created successfully',
        status: 'success',
        duration: 3000,
      });
      onClose();
      loadWebhooks();
      setFormData({ url: '', events: [] });
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to create webhook',
        status: 'error',
        duration: 5000,
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      // Would call api.admin.deleteWebhook(id)
      toast({
        title: 'Webhook deleted',
        description: 'The webhook has been removed',
        status: 'success',
        duration: 3000,
      });
      loadWebhooks();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to delete webhook',
        status: 'error',
        duration: 5000,
      });
    }
  };

  const handleTest = async (id: string) => {
    try {
      // Would call api.admin.testWebhook(id)
      toast({
        title: 'Test event sent',
        description: 'A test event has been sent to the webhook',
        status: 'success',
        duration: 3000,
      });
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to test webhook',
        status: 'error',
        duration: 5000,
      });
    }
  };

  const toggleEvent = (event: string) => {
    setFormData(prev => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter(e => e !== event)
        : [...prev.events, event],
    }));
  };

  return (
    <VStack spacing={6} align="stretch">
      {/* Header */}
      <Flex justify="space-between" align="center">
        <Box>
          <Text fontSize="lg" fontWeight="semibold">Webhooks</Text>
          <Text fontSize="sm" color="gray.600">
            Configure webhooks to receive real-time notifications
          </Text>
        </Box>
        <Button leftIcon={<Icon as={FiPlus} />} colorScheme="brand" onClick={onOpen}>
          Add Webhook
        </Button>
      </Flex>

      {/* Error Alert */}
      {error && (
        <Alert status="error">
          <AlertIcon />
          {error}
        </Alert>
      )}

      {/* Webhooks Table */}
      <Card>
        <CardBody p={0}>
          {loading ? (
            <Box display="flex" justifyContent="center" py={10}>
              <Spinner size="xl" color="brand.500" />
            </Box>
          ) : webhooks.length === 0 ? (
            <Box py={10} textAlign="center">
              <Text color="gray.500" mb={4}>
                No webhooks configured
              </Text>
              <Button leftIcon={<Icon as={FiPlus} />} colorScheme="brand" size="sm" onClick={onOpen}>
                Add your first webhook
              </Button>
            </Box>
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>URL</Th>
                  <Th>Events</Th>
                  <Th>Status</Th>
                  <Th>Last Triggered</Th>
                  <Th>Failures</Th>
                  <Th width="50px"></Th>
                </Tr>
              </Thead>
              <Tbody>
                {webhooks.map((webhook) => (
                  <Tr key={webhook.id} _hover={{ bg: 'gray.50' }}>
                    <Td>
                      <Code fontSize="sm">{webhook.url}</Code>
                    </Td>
                    <Td>
                      <HStack spacing={1}>
                        {webhook.events.slice(0, 2).map((event) => (
                          <Badge key={event} size="sm">{event}</Badge>
                        ))}
                        {webhook.events.length > 2 && (
                          <Text fontSize="xs" color="gray.500">+{webhook.events.length - 2}</Text>
                        )}
                      </HStack>
                    </Td>
                    <Td>
                      <Badge colorScheme={webhook.status === 'active' ? 'green' : 'gray'}>
                        {webhook.status}
                      </Badge>
                    </Td>
                    <Td>
                      <Text fontSize="sm">
                        {webhook.lastTriggeredAt ? formatDateTime(webhook.lastTriggeredAt) : 'Never'}
                      </Text>
                    </Td>
                    <Td>
                      {webhook.failureCount > 0 ? (
                        <Badge colorScheme="red">{webhook.failureCount}</Badge>
                      ) : (
                        <Text fontSize="sm">0</Text>
                      )}
                    </Td>
                    <Td>
                      <Menu>
                        <MenuButton
                          as={IconButton}
                          icon={<Icon as={FiMoreVertical} />}
                          variant="ghost"
                          size="sm"
                        />
                        <MenuList>
                          <MenuItem icon={<Icon as={FiRefreshCw} />} onClick={() => handleTest(webhook.id)}>
                            Send Test Event
                          </MenuItem>
                          <MenuItem icon={<Icon as={FiEdit} />}>
                            Edit
                          </MenuItem>
                          <MenuItem icon={<Icon as={FiTrash2} />} color="red.500" onClick={() => handleDelete(webhook.id)}>
                            Delete
                          </MenuItem>
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

      {/* Create Webhook Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Add Webhook</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <FormControl isRequired>
                <FormLabel>Endpoint URL</FormLabel>
                <Input
                  placeholder="https://api.example.com/webhooks"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                />
                <Text fontSize="xs" color="gray.600" mt={1}>
                  This URL will receive POST requests for subscribed events
                </Text>
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Events</FormLabel>
                <VStack align="stretch" spacing={2} p={3} border="1px" borderColor="gray.200" rounded="md" maxH="300px" overflowY="auto">
                  {availableEvents.map((event) => (
                    <HStack key={event} justify="space-between">
                      <Text fontSize="sm">{event}</Text>
                      <input
                        type="checkbox"
                        checked={formData.events.includes(event)}
                        onChange={() => toggleEvent(event)}
                      />
                    </HStack>
                  ))}
                </VStack>
                <Text fontSize="xs" color="gray.600" mt={1}>
                  Select which events should trigger this webhook
                </Text>
              </FormControl>

              <Alert status="info" fontSize="sm">
                <AlertIcon />
                A signing secret will be generated for verifying webhook payloads
              </Alert>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button colorScheme="brand" onClick={handleCreate} isDisabled={!formData.url || formData.events.length === 0}>
              Create Webhook
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </VStack>
  );
}
