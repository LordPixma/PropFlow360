import {
  Box,
  Heading,
  Card,
  CardBody,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  SimpleGrid,
  Text,
  Badge,
  HStack,
  VStack,
  Button,
  Icon,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Flex,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Spinner,
  Center,
  Alert,
  AlertIcon,
} from '@chakra-ui/react';
import type { LoaderFunctionArgs } from '@remix-run/cloudflare';
import { json } from '@remix-run/cloudflare';
import { Link, useLoaderData, useParams } from '@remix-run/react';
import {
  FiEdit,
  FiPlus,
  FiMapPin,
  FiHome,
  FiUsers,
  FiCalendar,
  FiMoreVertical,
  FiEye,
  FiTrash2,
  FiChevronRight,
} from 'react-icons/fi';
import { createApiClient } from '~/lib/api.server';
import { getSession } from '~/lib/session.server';

interface Unit {
  id: string;
  name: string;
  type: string;
  maxGuests: number;
  status: string;
}

interface Property {
  id: string;
  name: string;
  type: string;
  description: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string;
  status: string;
  checkInTime: string;
  checkOutTime: string;
  timezone: string;
  currency: string;
}

interface LoaderData {
  property: Property | null;
  units: Unit[];
  error?: string;
}

export async function loader({ request, context, params }: LoaderFunctionArgs) {
  const session = await getSession(request, context);
  const accessToken = session.get('accessToken');

  if (!accessToken) {
    return json<LoaderData>({ property: null, units: [], error: 'Not authenticated' });
  }

  try {
    const api = createApiClient(context, accessToken);

    // Fetch property and units in parallel
    const [propertyRes, unitsRes] = await Promise.all([
      api.get<Property>(`/properties/${params.id}`),
      api.get<Unit[]>(`/properties/${params.id}/units`),
    ]);

    if (!propertyRes.success || !propertyRes.data) {
      return json<LoaderData>({ property: null, units: [], error: propertyRes.error?.message || 'Property not found' });
    }

    return json<LoaderData>({
      property: propertyRes.data,
      units: unitsRes.data || [],
    });
  } catch (error) {
    console.error('Error loading property:', error);
    return json<LoaderData>({ property: null, units: [], error: 'Failed to load property' });
  }
}

const statusColors: Record<string, string> = {
  active: 'green',
  inactive: 'gray',
  maintenance: 'orange',
  archived: 'red',
};

const typeLabels: Record<string, string> = {
  residential: 'Residential',
  commercial: 'Commercial',
  studio: 'Studio',
  mixed: 'Mixed Use',
  holiday_let: 'Holiday Let',
};

const unitTypeLabels: Record<string, string> = {
  room: 'Room',
  apartment: 'Apartment',
  studio: 'Studio',
  office: 'Office',
  entire_property: 'Entire Property',
  suite: 'Suite',
  villa: 'Villa',
};

export default function PropertyDetail() {
  const { id } = useParams();
  const { property, units, error } = useLoaderData<typeof loader>();

  if (error) {
    return (
      <Box>
        <Alert status="error">
          <AlertIcon />
          {error}
        </Alert>
      </Box>
    );
  }

  if (!property) {
    return (
      <Center py={10}>
        <Spinner size="lg" color="brand.500" />
      </Center>
    );
  }

  return (
    <Box>
      {/* Breadcrumb */}
      <Breadcrumb mb={4} separator={<Icon as={FiChevronRight} color="gray.400" />}>
        <BreadcrumbItem>
          <BreadcrumbLink as={Link} to="/app/properties">
            Properties
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>
          <BreadcrumbLink>{property.name}</BreadcrumbLink>
        </BreadcrumbItem>
      </Breadcrumb>

      {/* Header */}
      <Flex justify="space-between" align="start" mb={6}>
        <Box>
          <HStack mb={2}>
            <Heading size="lg">{property.name}</Heading>
            <Badge colorScheme={statusColors[property.status]}>{property.status}</Badge>
          </HStack>
          <HStack color="gray.600" spacing={4}>
            {property.city && (
              <HStack>
                <Icon as={FiMapPin} />
                <Text>
                  {property.city}{property.postalCode && `, ${property.postalCode}`}
                </Text>
              </HStack>
            )}
            <HStack>
              <Icon as={FiHome} />
              <Text>{units.length} units</Text>
            </HStack>
          </HStack>
        </Box>
        <HStack>
          <Button as={Link} to={`/app/properties/${id}/edit`} leftIcon={<Icon as={FiEdit} />} variant="outline">
            Edit
          </Button>
          <Button as={Link} to={`/app/properties/${id}/units/new`} leftIcon={<Icon as={FiPlus} />} colorScheme="brand">
            Add Unit
          </Button>
        </HStack>
      </Flex>

      {/* Stats */}
      <SimpleGrid columns={{ base: 1, md: 4 }} spacing={4} mb={6}>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Total Units</StatLabel>
              <StatNumber>{units.length}</StatNumber>
              <StatHelpText>{units.filter(u => u.status === 'active').length} active</StatHelpText>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Property Type</StatLabel>
              <StatNumber fontSize="lg">{typeLabels[property.type] || property.type}</StatNumber>
              <StatHelpText>{property.currency}</StatHelpText>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Timezone</StatLabel>
              <StatNumber fontSize="lg">{property.timezone}</StatNumber>
              <StatHelpText>Local time</StatHelpText>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Check-in / Check-out</StatLabel>
              <StatNumber fontSize="lg">
                {property.checkInTime} / {property.checkOutTime}
              </StatNumber>
              <StatHelpText>Default times</StatHelpText>
            </Stat>
          </CardBody>
        </Card>
      </SimpleGrid>

      {/* Tabs */}
      <Tabs colorScheme="brand">
        <TabList>
          <Tab>Units</Tab>
          <Tab>Calendar</Tab>
          <Tab>Bookings</Tab>
          <Tab>Settings</Tab>
        </TabList>

        <TabPanels>
          {/* Units Tab */}
          <TabPanel px={0}>
            <Card>
              <CardBody p={0}>
                {units.length === 0 ? (
                  <Center py={10} flexDirection="column">
                    <Icon as={FiHome} boxSize={12} color="gray.300" mb={4} />
                    <Text color="gray.500" mb={4}>
                      No units yet
                    </Text>
                    <Button as={Link} to={`/app/properties/${id}/units/new`} colorScheme="brand" size="sm">
                      Add your first unit
                    </Button>
                  </Center>
                ) : (
                  <Table>
                    <Thead>
                      <Tr>
                        <Th>Unit</Th>
                        <Th>Type</Th>
                        <Th isNumeric>Max Guests</Th>
                        <Th>Status</Th>
                        <Th width="50px"></Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {units.map((unit) => (
                        <Tr key={unit.id} _hover={{ bg: 'gray.50' }}>
                          <Td>
                            <Link to={`/app/units/${unit.id}`}>
                              <Text fontWeight="medium" color="brand.600" _hover={{ textDecoration: 'underline' }}>
                                {unit.name}
                              </Text>
                            </Link>
                          </Td>
                          <Td>
                            <Badge variant="subtle">{unitTypeLabels[unit.type] || unit.type}</Badge>
                          </Td>
                          <Td isNumeric>
                            <HStack justify="flex-end">
                              <Icon as={FiUsers} boxSize={4} color="gray.400" />
                              <Text>{unit.maxGuests}</Text>
                            </HStack>
                          </Td>
                          <Td>
                            <Badge colorScheme={statusColors[unit.status]}>{unit.status}</Badge>
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
                                <MenuItem as={Link} to={`/app/units/${unit.id}`} icon={<Icon as={FiEye} />}>
                                  View
                                </MenuItem>
                                <MenuItem as={Link} to={`/app/units/${unit.id}/edit`} icon={<Icon as={FiEdit} />}>
                                  Edit
                                </MenuItem>
                                <MenuItem as={Link} to={`/app/units/${unit.id}/calendar`} icon={<Icon as={FiCalendar} />}>
                                  Calendar
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
          </TabPanel>

          {/* Calendar Tab */}
          <TabPanel>
            <Card>
              <CardBody>
                <Text color="gray.500">Calendar view coming soon...</Text>
              </CardBody>
            </Card>
          </TabPanel>

          {/* Bookings Tab */}
          <TabPanel>
            <Card>
              <CardBody>
                <Text color="gray.500">Bookings list coming soon...</Text>
              </CardBody>
            </Card>
          </TabPanel>

          {/* Settings Tab */}
          <TabPanel>
            <Card>
              <CardBody>
                <VStack align="stretch" spacing={4}>
                  <Box>
                    <Text fontWeight="medium" mb={1}>
                      Description
                    </Text>
                    <Text color="gray.600">{property.description || 'No description'}</Text>
                  </Box>
                  <SimpleGrid columns={2} spacing={4}>
                    <Box>
                      <Text fontWeight="medium" mb={1}>
                        Address
                      </Text>
                      <Text color="gray.600">
                        {property.addressLine1 || 'No address'}
                        {property.addressLine2 && <><br />{property.addressLine2}</>}
                        {property.city && <><br />{property.city}{property.postalCode && `, ${property.postalCode}`}</>}
                        {property.country && <><br />{property.country}</>}
                      </Text>
                    </Box>
                    <Box>
                      <Text fontWeight="medium" mb={1}>
                        Default Times
                      </Text>
                      <Text color="gray.600">
                        Check-in: {property.checkInTime}
                        <br />
                        Check-out: {property.checkOutTime}
                      </Text>
                    </Box>
                  </SimpleGrid>
                </VStack>
              </CardBody>
            </Card>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
}
