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
import { FiSearch, FiPlus, FiMoreVertical, FiEdit, FiTrash2, FiEye, FiMapPin, FiHome } from 'react-icons/fi';
import { createApiClient } from '~/lib/api.server';
import { getSession } from '~/lib/session.server';

interface Property {
  id: string;
  name: string;
  type: string;
  city: string;
  status: string;
  unitsCount?: number;
}

interface LoaderData {
  properties: Property[];
  error?: string;
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  const session = await getSession(request, context);
  const accessToken = session.get('accessToken');

  if (!accessToken) {
    return json<LoaderData>({ properties: [], error: 'Not authenticated' });
  }

  const url = new URL(request.url);
  const search = url.searchParams.get('search') || '';
  const type = url.searchParams.get('type') || '';
  const status = url.searchParams.get('status') || '';

  try {
    const api = createApiClient(context, accessToken);
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (type) params.type = type;
    if (status) params.status = status;

    const response = await api.get<Property[]>('/properties', params);

    if (response.success && response.data) {
      return json<LoaderData>({ properties: response.data });
    }

    return json<LoaderData>({ properties: [], error: response.error?.message || 'Failed to load properties' });
  } catch (error) {
    console.error('Error loading properties:', error);
    return json<LoaderData>({ properties: [], error: 'Failed to load properties' });
  }
}

const statusColors: Record<string, string> = {
  active: 'green',
  inactive: 'gray',
  archived: 'red',
};

const typeLabels: Record<string, string> = {
  residential: 'Residential',
  commercial: 'Commercial',
  studio: 'Studio',
  mixed: 'Mixed Use',
  holiday_let: 'Holiday Let',
};

export default function PropertiesList() {
  const { properties, error } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigation = useNavigation();

  const isLoading = navigation.state === 'loading';

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchParams((prev) => {
      if (value) {
        prev.set('search', value);
      } else {
        prev.delete('search');
      }
      return prev;
    });
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSearchParams((prev) => {
      if (value) {
        prev.set('type', value);
      } else {
        prev.delete('type');
      }
      return prev;
    });
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSearchParams((prev) => {
      if (value) {
        prev.set('status', value);
      } else {
        prev.delete('status');
      }
      return prev;
    });
  };

  return (
    <Box>
      {/* Header */}
      <Flex justify="space-between" align="center" mb={6}>
        <Heading size="lg">Properties</Heading>
        <Button as={Link} to="/app/properties/new" leftIcon={<Icon as={FiPlus} />} colorScheme="brand">
          Add Property
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
              <Input
                placeholder="Search properties..."
                defaultValue={searchParams.get('search') || ''}
                onChange={handleSearchChange}
              />
            </InputGroup>
            <Select
              maxW="200px"
              placeholder="All Types"
              value={searchParams.get('type') || ''}
              onChange={handleTypeChange}
            >
              <option value="residential">Residential</option>
              <option value="commercial">Commercial</option>
              <option value="studio">Studio</option>
              <option value="mixed">Mixed Use</option>
              <option value="holiday_let">Holiday Let</option>
            </Select>
            <Select
              maxW="150px"
              placeholder="All Status"
              value={searchParams.get('status') || ''}
              onChange={handleStatusChange}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
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

      {/* Properties Table */}
      <Card>
        <CardBody p={0}>
          {isLoading ? (
            <Center py={10}>
              <Spinner size="lg" color="brand.500" />
            </Center>
          ) : properties.length === 0 ? (
            <Center py={10} flexDirection="column">
              <Icon as={FiHome} boxSize={12} color="gray.300" mb={4} />
              <Text color="gray.500" mb={4}>
                No properties found
              </Text>
              <Button as={Link} to="/app/properties/new" colorScheme="brand" size="sm">
                Add your first property
              </Button>
            </Center>
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Property</Th>
                  <Th>Type</Th>
                  <Th>Location</Th>
                  <Th isNumeric>Units</Th>
                  <Th>Status</Th>
                  <Th width="50px"></Th>
                </Tr>
              </Thead>
              <Tbody>
                {properties.map((property) => (
                  <Tr key={property.id} _hover={{ bg: 'gray.50' }}>
                    <Td>
                      <Link to={`/app/properties/${property.id}`}>
                        <Text fontWeight="medium" color="brand.600" _hover={{ textDecoration: 'underline' }}>
                          {property.name}
                        </Text>
                      </Link>
                    </Td>
                    <Td>
                      <Badge variant="subtle" colorScheme="gray">
                        {typeLabels[property.type] || property.type}
                      </Badge>
                    </Td>
                    <Td>
                      {property.city && (
                        <HStack spacing={1} color="gray.600">
                          <Icon as={FiMapPin} boxSize={4} />
                          <Text>{property.city}</Text>
                        </HStack>
                      )}
                    </Td>
                    <Td isNumeric>{property.unitsCount ?? '-'}</Td>
                    <Td>
                      <Badge colorScheme={statusColors[property.status]}>{property.status}</Badge>
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
                          <MenuItem as={Link} to={`/app/properties/${property.id}`} icon={<Icon as={FiEye} />}>
                            View
                          </MenuItem>
                          <MenuItem as={Link} to={`/app/properties/${property.id}/edit`} icon={<Icon as={FiEdit} />}>
                            Edit
                          </MenuItem>
                          <MenuItem icon={<Icon as={FiTrash2} />} color="red.500">
                            Archive
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
    </Box>
  );
}
