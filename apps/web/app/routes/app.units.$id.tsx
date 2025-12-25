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
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Flex,
  Divider,
  List,
  ListItem,
  ListIcon,
} from '@chakra-ui/react';
import { Link, useParams } from '@remix-run/react';
import {
  FiEdit,
  FiMapPin,
  FiHome,
  FiUsers,
  FiCalendar,
  FiChevronRight,
  FiCheck,
  FiMaximize,
  FiBed,
  FiDroplet,
} from 'react-icons/fi';

// TODO: Replace with actual data from loader
const mockUnit = {
  id: '1',
  propertyId: '1',
  propertyName: 'Seaside Apartments',
  name: 'Unit 1A - Studio',
  type: 'studio',
  description: 'Cozy studio apartment with ocean views. Features a fully equipped kitchen, comfortable queen bed, and private balcony.',
  maxGuests: 2,
  bedrooms: 0,
  beds: 1,
  bathrooms: 1,
  sizeSqm: 35,
  floor: 1,
  status: 'active',
  amenities: [
    'WiFi',
    'Air Conditioning',
    'Heating',
    'Kitchen',
    'Washing Machine',
    'TV',
    'Balcony',
    'Ocean View',
    'Parking',
  ],
  pricing: {
    baseNightly: 95,
    baseWeekly: 550,
    baseMonthly: 1800,
    currentRate: 95,
  },
  stats: {
    occupancy: 80,
    avgNightlyRate: 102,
    revenueThisMonth: 2856,
    upcomingBookings: 3,
  },
};

const statusColors: Record<string, string> = {
  active: 'green',
  inactive: 'gray',
  maintenance: 'orange',
  archived: 'red',
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

export default function UnitDetail() {
  const { id } = useParams();
  const unit = mockUnit; // TODO: Fetch from API

  return (
    <Box>
      {/* Breadcrumb */}
      <Breadcrumb mb={4} separator={<Icon as={FiChevronRight} color="gray.400" />}>
        <BreadcrumbItem>
          <BreadcrumbLink as={Link} to="/app/properties">
            Properties
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbItem>
          <BreadcrumbLink as={Link} to={`/app/properties/${unit.propertyId}`}>
            {unit.propertyName}
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>
          <BreadcrumbLink>{unit.name}</BreadcrumbLink>
        </BreadcrumbItem>
      </Breadcrumb>

      {/* Header */}
      <Flex justify="space-between" align="start" mb={6}>
        <Box>
          <HStack mb={2}>
            <Heading size="lg">{unit.name}</Heading>
            <Badge colorScheme={statusColors[unit.status]}>{unit.status}</Badge>
          </HStack>
          <HStack color="gray.600" spacing={4}>
            <HStack>
              <Icon as={FiHome} />
              <Text>{unitTypeLabels[unit.type] || unit.type}</Text>
            </HStack>
            <HStack>
              <Icon as={FiUsers} />
              <Text>{unit.maxGuests} guests</Text>
            </HStack>
            <HStack>
              <Icon as={FiMaximize} />
              <Text>{unit.sizeSqm} m²</Text>
            </HStack>
          </HStack>
        </Box>
        <HStack>
          <Button as={Link} to={`/app/units/${id}/calendar`} leftIcon={<Icon as={FiCalendar} />} variant="outline">
            Calendar
          </Button>
          <Button as={Link} to={`/app/units/${id}/edit`} leftIcon={<Icon as={FiEdit} />} colorScheme="brand">
            Edit
          </Button>
        </HStack>
      </Flex>

      {/* Stats */}
      <SimpleGrid columns={{ base: 1, md: 4 }} spacing={4} mb={6}>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Occupancy</StatLabel>
              <StatNumber>{unit.stats.occupancy}%</StatNumber>
              <StatHelpText>This month</StatHelpText>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Avg Nightly Rate</StatLabel>
              <StatNumber>£{unit.stats.avgNightlyRate}</StatNumber>
              <StatHelpText>This month</StatHelpText>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Revenue</StatLabel>
              <StatNumber>£{unit.stats.revenueThisMonth.toLocaleString()}</StatNumber>
              <StatHelpText>December 2024</StatHelpText>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Upcoming Bookings</StatLabel>
              <StatNumber>{unit.stats.upcomingBookings}</StatNumber>
              <StatHelpText>Next 30 days</StatHelpText>
            </Stat>
          </CardBody>
        </Card>
      </SimpleGrid>

      {/* Tabs */}
      <Tabs colorScheme="brand">
        <TabList>
          <Tab>Overview</Tab>
          <Tab>Pricing</Tab>
          <Tab>Bookings</Tab>
          <Tab>Calendar</Tab>
        </TabList>

        <TabPanels>
          {/* Overview Tab */}
          <TabPanel px={0}>
            <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
              {/* Description & Details */}
              <Card>
                <CardBody>
                  <VStack align="stretch" spacing={4}>
                    <Box>
                      <Text fontWeight="medium" mb={2}>
                        Description
                      </Text>
                      <Text color="gray.600">{unit.description}</Text>
                    </Box>
                    <Divider />
                    <SimpleGrid columns={2} spacing={4}>
                      <Box>
                        <HStack color="gray.500" mb={1}>
                          <Icon as={FiBed} />
                          <Text fontWeight="medium">Bedrooms</Text>
                        </HStack>
                        <Text>{unit.bedrooms === 0 ? 'Studio' : unit.bedrooms}</Text>
                      </Box>
                      <Box>
                        <HStack color="gray.500" mb={1}>
                          <Icon as={FiBed} />
                          <Text fontWeight="medium">Beds</Text>
                        </HStack>
                        <Text>{unit.beds}</Text>
                      </Box>
                      <Box>
                        <HStack color="gray.500" mb={1}>
                          <Icon as={FiDroplet} />
                          <Text fontWeight="medium">Bathrooms</Text>
                        </HStack>
                        <Text>{unit.bathrooms}</Text>
                      </Box>
                      <Box>
                        <HStack color="gray.500" mb={1}>
                          <Icon as={FiMapPin} />
                          <Text fontWeight="medium">Floor</Text>
                        </HStack>
                        <Text>{unit.floor}</Text>
                      </Box>
                    </SimpleGrid>
                  </VStack>
                </CardBody>
              </Card>

              {/* Amenities */}
              <Card>
                <CardBody>
                  <Text fontWeight="medium" mb={4}>
                    Amenities
                  </Text>
                  <List spacing={2}>
                    {unit.amenities.map((amenity) => (
                      <ListItem key={amenity}>
                        <HStack>
                          <ListIcon as={FiCheck} color="green.500" />
                          <Text>{amenity}</Text>
                        </HStack>
                      </ListItem>
                    ))}
                  </List>
                </CardBody>
              </Card>
            </SimpleGrid>
          </TabPanel>

          {/* Pricing Tab */}
          <TabPanel px={0}>
            <Card>
              <CardBody>
                <VStack align="stretch" spacing={4}>
                  <Heading size="sm">Base Rates</Heading>
                  <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                    <Box p={4} bg="gray.50" borderRadius="md">
                      <Text color="gray.500" fontSize="sm">
                        Nightly
                      </Text>
                      <Text fontSize="2xl" fontWeight="bold">
                        £{unit.pricing.baseNightly}
                      </Text>
                    </Box>
                    <Box p={4} bg="gray.50" borderRadius="md">
                      <Text color="gray.500" fontSize="sm">
                        Weekly
                      </Text>
                      <Text fontSize="2xl" fontWeight="bold">
                        £{unit.pricing.baseWeekly}
                      </Text>
                    </Box>
                    <Box p={4} bg="gray.50" borderRadius="md">
                      <Text color="gray.500" fontSize="sm">
                        Monthly
                      </Text>
                      <Text fontSize="2xl" fontWeight="bold">
                        £{unit.pricing.baseMonthly}
                      </Text>
                    </Box>
                  </SimpleGrid>
                  <Divider />
                  <Text color="gray.500">
                    Seasonal pricing and custom rate rules coming soon...
                  </Text>
                </VStack>
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

          {/* Calendar Tab */}
          <TabPanel>
            <Card>
              <CardBody>
                <Text color="gray.500">Calendar view coming soon...</Text>
              </CardBody>
            </Card>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
}
