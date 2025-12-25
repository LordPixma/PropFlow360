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
  Textarea,
  useDisclosure,
  useToast,
  Code,
  Icon,
  Flex,
} from '@chakra-ui/react';
import { FiPlus, FiMoreVertical, FiTrash2, FiCopy, FiKey } from 'react-icons/fi';
import { api } from '../lib/api';
import { formatDateTime } from '../utils/format';

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

export default function AdminApiKeys() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newKeyData, setNewKeyData] = useState<{ key: string } | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isNewKeyOpen, onOpen: onNewKeyOpen, onClose: onNewKeyClose } = useDisclosure();
  const [formData, setFormData] = useState({ name: '', scopes: '', expiresInDays: '' });
  const toast = useToast();

  useEffect(() => {
    loadApiKeys();
  }, []);

  const loadApiKeys = async () => {
    try {
      setLoading(true);
      setError(null);
      // API endpoint would be /admin/api-keys
      // For now, mock the response
      setKeys([]);
    } catch (err: any) {
      setError(err.message || 'Failed to load API keys');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      // Would call api.admin.createApiKey(formData)
      toast({
        title: 'API Key created',
        description: 'Your API key has been created successfully',
        status: 'success',
        duration: 3000,
      });

      // Mock response
      setNewKeyData({ key: 'pk_test_' + Math.random().toString(36).substring(2) });
      onClose();
      onNewKeyOpen();
      loadApiKeys();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to create API key',
        status: 'error',
        duration: 5000,
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      // Would call api.admin.deleteApiKey(id)
      toast({
        title: 'API Key deleted',
        description: 'The API key has been revoked',
        status: 'success',
        duration: 3000,
      });
      loadApiKeys();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to delete API key',
        status: 'error',
        duration: 5000,
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied!',
      description: 'API key copied to clipboard',
      status: 'success',
      duration: 2000,
    });
  };

  return (
    <VStack spacing={6} align="stretch">
      {/* Header */}
      <Flex justify="space-between" align="center">
        <Box>
          <Text fontSize="lg" fontWeight="semibold">API Keys</Text>
          <Text fontSize="sm" color="gray.600">
            Manage API keys for integrations and third-party access
          </Text>
        </Box>
        <Button leftIcon={<Icon as={FiPlus} />} colorScheme="brand" onClick={onOpen}>
          Create API Key
        </Button>
      </Flex>

      {/* Error Alert */}
      {error && (
        <Alert status="error">
          <AlertIcon />
          {error}
        </Alert>
      )}

      {/* API Keys Table */}
      <Card>
        <CardBody p={0}>
          {loading ? (
            <Box display="flex" justifyContent="center" py={10}>
              <Spinner size="xl" color="brand.500" />
            </Box>
          ) : keys.length === 0 ? (
            <Box py={10} textAlign="center">
              <Icon as={FiKey} boxSize={12} color="gray.300" mb={4} />
              <Text color="gray.500" mb={4}>
                No API keys yet
              </Text>
              <Button leftIcon={<Icon as={FiPlus} />} colorScheme="brand" size="sm" onClick={onOpen}>
                Create your first API key
              </Button>
            </Box>
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Name</Th>
                  <Th>Key Prefix</Th>
                  <Th>Scopes</Th>
                  <Th>Last Used</Th>
                  <Th>Expires</Th>
                  <Th width="50px"></Th>
                </Tr>
              </Thead>
              <Tbody>
                {keys.map((key) => (
                  <Tr key={key.id} _hover={{ bg: 'gray.50' }}>
                    <Td>
                      <Text fontWeight="medium">{key.name}</Text>
                    </Td>
                    <Td>
                      <Code fontSize="sm">{key.keyPrefix}...</Code>
                    </Td>
                    <Td>
                      <HStack spacing={1}>
                        {key.scopes.slice(0, 2).map((scope) => (
                          <Badge key={scope} size="sm">{scope}</Badge>
                        ))}
                        {key.scopes.length > 2 && (
                          <Text fontSize="xs" color="gray.500">+{key.scopes.length - 2}</Text>
                        )}
                      </HStack>
                    </Td>
                    <Td>
                      <Text fontSize="sm">{key.lastUsedAt ? formatDateTime(key.lastUsedAt) : 'Never'}</Text>
                    </Td>
                    <Td>
                      {key.expiresAt ? (
                        <Text fontSize="sm">{formatDateTime(key.expiresAt)}</Text>
                      ) : (
                        <Badge colorScheme="green">Never</Badge>
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
                          <MenuItem icon={<Icon as={FiTrash2} />} color="red.500" onClick={() => handleDelete(key.id)}>
                            Revoke Key
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

      {/* Create API Key Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Create API Key</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Name</FormLabel>
                <Input
                  placeholder="e.g., Production API"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </FormControl>

              <FormControl>
                <FormLabel>Scopes</FormLabel>
                <Textarea
                  placeholder="read:bookings, write:bookings"
                  value={formData.scopes}
                  onChange={(e) => setFormData({ ...formData, scopes: e.target.value })}
                  rows={3}
                />
                <Text fontSize="xs" color="gray.600" mt={1}>
                  Comma-separated list of scopes
                </Text>
              </FormControl>

              <FormControl>
                <FormLabel>Expires In (Days)</FormLabel>
                <Input
                  type="number"
                  placeholder="Leave empty for no expiration"
                  value={formData.expiresInDays}
                  onChange={(e) => setFormData({ ...formData, expiresInDays: e.target.value })}
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button colorScheme="brand" onClick={handleCreate}>
              Create Key
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* New Key Display Modal */}
      <Modal isOpen={isNewKeyOpen} onClose={onNewKeyClose} closeOnOverlayClick={false}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>API Key Created</ModalHeader>
          <ModalBody>
            <Alert status="warning" mb={4}>
              <AlertIcon />
              Make sure to copy your API key now. You won't be able to see it again!
            </Alert>
            <VStack align="stretch" spacing={3}>
              <Text fontWeight="medium">Your API Key:</Text>
              <HStack>
                <Code p={3} rounded="md" flex={1} fontSize="sm">
                  {newKeyData?.key}
                </Code>
                <IconButton
                  icon={<Icon as={FiCopy} />}
                  aria-label="Copy"
                  onClick={() => copyToClipboard(newKeyData?.key || '')}
                />
              </HStack>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="brand" onClick={() => {
              onNewKeyClose();
              setNewKeyData(null);
            }}>
              I've Saved My Key
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </VStack>
  );
}
