import {
  Box,
  Heading,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  Card,
  CardBody,
  Text,
  VStack,
  HStack,
  Icon,
  Progress,
} from '@chakra-ui/react';
import { FiHome, FiCalendar, FiDollarSign, FiUsers } from 'react-icons/fi';

export default function Dashboard() {
  // TODO: Fetch real data from API
  const stats = {
    properties: 12,
    units: 48,
    occupancyRate: 78,
    monthlyRevenue: 45600,
    revenueChange: 12.5,
    upcomingCheckIns: 8,
    upcomingCheckOuts: 5,
    pendingMaintenance: 3,
  };

  return (
    <Box>
      <Heading size="lg" mb={6}>
        Dashboard
      </Heading>

      {/* Key Metrics */}
      <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6} mb={8}>
        <Card>
          <CardBody>
            <HStack justify="space-between" mb={2}>
              <Stat>
                <StatLabel>Properties</StatLabel>
                <StatNumber>{stats.properties}</StatNumber>
                <StatHelpText>{stats.units} units total</StatHelpText>
              </Stat>
              <Icon as={FiHome} boxSize={8} color="brand.500" />
            </HStack>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <HStack justify="space-between" mb={2}>
              <Stat>
                <StatLabel>Occupancy Rate</StatLabel>
                <StatNumber>{stats.occupancyRate}%</StatNumber>
                <StatHelpText>
                  <StatArrow type="increase" />
                  5% vs last month
                </StatHelpText>
              </Stat>
              <Icon as={FiCalendar} boxSize={8} color="green.500" />
            </HStack>
            <Progress value={stats.occupancyRate} colorScheme="green" size="sm" rounded="full" />
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <HStack justify="space-between" mb={2}>
              <Stat>
                <StatLabel>Monthly Revenue</StatLabel>
                <StatNumber>£{stats.monthlyRevenue.toLocaleString()}</StatNumber>
                <StatHelpText>
                  <StatArrow type="increase" />
                  {stats.revenueChange}%
                </StatHelpText>
              </Stat>
              <Icon as={FiDollarSign} boxSize={8} color="blue.500" />
            </HStack>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <HStack justify="space-between" mb={2}>
              <Stat>
                <StatLabel>Upcoming Activity</StatLabel>
                <StatNumber>{stats.upcomingCheckIns + stats.upcomingCheckOuts}</StatNumber>
                <StatHelpText>Next 7 days</StatHelpText>
              </Stat>
              <Icon as={FiUsers} boxSize={8} color="purple.500" />
            </HStack>
          </CardBody>
        </Card>
      </SimpleGrid>

      {/* Activity Summary */}
      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
        <Card>
          <CardBody>
            <Heading size="md" mb={4}>
              Today's Activity
            </Heading>
            <VStack align="stretch" spacing={3}>
              <HStack justify="space-between" p={3} bg="green.50" rounded="md">
                <Text>Check-ins</Text>
                <Text fontWeight="bold" color="green.600">
                  {stats.upcomingCheckIns}
                </Text>
              </HStack>
              <HStack justify="space-between" p={3} bg="orange.50" rounded="md">
                <Text>Check-outs</Text>
                <Text fontWeight="bold" color="orange.600">
                  {stats.upcomingCheckOuts}
                </Text>
              </HStack>
              <HStack justify="space-between" p={3} bg="red.50" rounded="md">
                <Text>Pending Maintenance</Text>
                <Text fontWeight="bold" color="red.600">
                  {stats.pendingMaintenance}
                </Text>
              </HStack>
            </VStack>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <Heading size="md" mb={4}>
              Recent Bookings
            </Heading>
            <VStack align="stretch" spacing={3}>
              <HStack justify="space-between" p={3} bg="gray.50" rounded="md">
                <VStack align="start" spacing={0}>
                  <Text fontWeight="medium">Unit 4A - Ocean View</Text>
                  <Text fontSize="sm" color="gray.500">
                    John Smith • 3 nights
                  </Text>
                </VStack>
                <Text fontSize="sm" color="gray.600">
                  Dec 26-29
                </Text>
              </HStack>
              <HStack justify="space-between" p={3} bg="gray.50" rounded="md">
                <VStack align="start" spacing={0}>
                  <Text fontWeight="medium">Studio B - City Centre</Text>
                  <Text fontSize="sm" color="gray.500">
                    Sarah Johnson • 5 nights
                  </Text>
                </VStack>
                <Text fontSize="sm" color="gray.600">
                  Dec 27 - Jan 1
                </Text>
              </HStack>
              <HStack justify="space-between" p={3} bg="gray.50" rounded="md">
                <VStack align="start" spacing={0}>
                  <Text fontWeight="medium">Apartment 12 - Riverside</Text>
                  <Text fontSize="sm" color="gray.500">
                    Mike Brown • 2 nights
                  </Text>
                </VStack>
                <Text fontSize="sm" color="gray.600">
                  Dec 28-30
                </Text>
              </HStack>
            </VStack>
          </CardBody>
        </Card>
      </SimpleGrid>
    </Box>
  );
}
