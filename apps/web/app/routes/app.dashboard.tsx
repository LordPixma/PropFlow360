import { useState, useEffect } from 'react';
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
  CardHeader,
  Text,
  VStack,
  HStack,
  Icon,
  Progress,
  Select,
  Spinner,
  Alert,
  AlertIcon,
  Flex,
} from '@chakra-ui/react';
import { FiHome, FiCalendar, FiDollarSign, FiTrendingUp } from 'react-icons/fi';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { api } from '../lib/api';
import { formatCurrency, formatPercentage, formatDate } from '../utils/format';

export default function Dashboard() {
  const [period, setPeriod] = useState('last_30_days');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    loadDashboardData();
  }, [period]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [overview, revenue, occupancy, bookingsData] = await Promise.all([
        api.analytics.getDashboard(period),
        api.analytics.getRevenue(period),
        api.analytics.getOccupancy(period),
        api.analytics.getBookings(period),
      ]);

      setData({ overview, revenue, occupancy, bookingsData });
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Flex justify="center" align="center" h="400px">
        <Spinner size="xl" color="brand.500" />
      </Flex>
    );
  }

  if (error) {
    return (
      <Alert status="error">
        <AlertIcon />
        {error}
      </Alert>
    );
  }

  const { overview, revenue, occupancy, bookingsData } = data || {};
  const summary = overview?.summary || {};
  const revenueChart = revenue?.chartData || [];
  const occupancyChart = occupancy?.chartData || [];
  const revenueBreakdown = revenue?.breakdown || [];

  return (
    <Box>
      <Flex justify="space-between" align="center" mb={6}>
        <Heading size="lg">Dashboard</Heading>
        <Select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          width="200px"
        >
          <option value="last_7_days">Last 7 Days</option>
          <option value="last_30_days">Last 30 Days</option>
          <option value="last_90_days">Last 90 Days</option>
          <option value="ytd">Year to Date</option>
        </Select>
      </Flex>

      {/* Key Metrics */}
      <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6} mb={8}>
        <Card>
          <CardBody>
            <HStack justify="space-between" mb={2}>
              <Stat>
                <StatLabel>Total Revenue</StatLabel>
                <StatNumber>{formatCurrency(summary.totalRevenue || 0)}</StatNumber>
                <StatHelpText>
                  {summary.revenueChange !== undefined && (
                    <>
                      <StatArrow type={summary.revenueChange >= 0 ? 'increase' : 'decrease'} />
                      {formatPercentage(Math.abs(summary.revenueChange))} vs previous
                    </>
                  )}
                </StatHelpText>
              </Stat>
              <Icon as={FiDollarSign} boxSize={8} color="green.500" />
            </HStack>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <HStack justify="space-between" mb={2}>
              <Stat>
                <StatLabel>Occupancy Rate</StatLabel>
                <StatNumber>{formatPercentage(summary.averageOccupancy || 0)}</StatNumber>
                <StatHelpText>
                  {summary.occupancyChange !== undefined && (
                    <>
                      <StatArrow type={summary.occupancyChange >= 0 ? 'increase' : 'decrease'} />
                      {formatPercentage(Math.abs(summary.occupancyChange))} vs previous
                    </>
                  )}
                </StatHelpText>
              </Stat>
              <Icon as={FiCalendar} boxSize={8} color="blue.500" />
            </HStack>
            <Progress
              value={summary.averageOccupancy || 0}
              colorScheme="blue"
              size="sm"
              rounded="full"
            />
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <HStack justify="space-between" mb={2}>
              <Stat>
                <StatLabel>Total Bookings</StatLabel>
                <StatNumber>{summary.totalBookings || 0}</StatNumber>
                <StatHelpText>
                  ADR: {formatCurrency(summary.adr || 0)}
                </StatHelpText>
              </Stat>
              <Icon as={FiHome} boxSize={8} color="purple.500" />
            </HStack>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <HStack justify="space-between" mb={2}>
              <Stat>
                <StatLabel>RevPAR</StatLabel>
                <StatNumber>{formatCurrency(summary.revpar || 0)}</StatNumber>
                <StatHelpText>
                  Revenue per Available Room
                </StatHelpText>
              </Stat>
              <Icon as={FiTrendingUp} boxSize={8} color="orange.500" />
            </HStack>
          </CardBody>
        </Card>
      </SimpleGrid>

      {/* Charts */}
      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6} mb={8}>
        <Card>
          <CardHeader>
            <Heading size="md">Revenue Trend</Heading>
          </CardHeader>
          <CardBody>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={revenueChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(date) => formatDate(date).split(',')[0]} />
                <YAxis tickFormatter={(value) => `$${value}`} />
                <Tooltip
                  formatter={(value: any) => formatCurrency(value)}
                  labelFormatter={(date) => formatDate(date)}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3182CE"
                  strokeWidth={2}
                  name="Revenue"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <Heading size="md">Occupancy Trend</Heading>
          </CardHeader>
          <CardBody>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={occupancyChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(date) => formatDate(date).split(',')[0]} />
                <YAxis tickFormatter={(value) => `${value}%`} />
                <Tooltip
                  formatter={(value: any) => formatPercentage(value)}
                  labelFormatter={(date) => formatDate(date)}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="occupancyRate"
                  stroke="#38A169"
                  strokeWidth={2}
                  name="Occupancy %"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      </SimpleGrid>

      {/* Revenue Breakdown */}
      {revenueBreakdown.length > 0 && (
        <Card mb={8}>
          <CardHeader>
            <Heading size="md">Revenue by Property</Heading>
          </CardHeader>
          <CardBody>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={revenueBreakdown}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="propertyName" />
                <YAxis tickFormatter={(value) => `$${value}`} />
                <Tooltip formatter={(value: any) => formatCurrency(value)} />
                <Legend />
                <Bar dataKey="revenue" fill="#3182CE" name="Revenue" />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      )}

      {/* Quick Stats */}
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6}>
        <Card>
          <CardBody>
            <Heading size="sm" mb={4}>Booking Stats</Heading>
            <VStack align="stretch" spacing={3}>
              <HStack justify="space-between">
                <Text color="gray.600">New Bookings</Text>
                <Text fontWeight="bold">{bookingsData?.newBookings || 0}</Text>
              </HStack>
              <HStack justify="space-between">
                <Text color="gray.600">Cancellations</Text>
                <Text fontWeight="bold" color="red.500">{bookingsData?.cancellations || 0}</Text>
              </HStack>
              <HStack justify="space-between">
                <Text color="gray.600">Cancellation Rate</Text>
                <Text fontWeight="bold">
                  {formatPercentage(bookingsData?.cancellationRate || 0)}
                </Text>
              </HStack>
            </VStack>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <Heading size="sm" mb={4}>Guest Stats</Heading>
            <VStack align="stretch" spacing={3}>
              <HStack justify="space-between">
                <Text color="gray.600">Total Guests</Text>
                <Text fontWeight="bold">{bookingsData?.totalGuests || 0}</Text>
              </HStack>
              <HStack justify="space-between">
                <Text color="gray.600">New Guests</Text>
                <Text fontWeight="bold" color="green.500">{bookingsData?.newGuests || 0}</Text>
              </HStack>
              <HStack justify="space-between">
                <Text color="gray.600">Returning Guests</Text>
                <Text fontWeight="bold">{bookingsData?.returningGuests || 0}</Text>
              </HStack>
            </VStack>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <Heading size="sm" mb={4}>Performance</Heading>
            <VStack align="stretch" spacing={3}>
              <HStack justify="space-between">
                <Text color="gray.600">Avg Stay Length</Text>
                <Text fontWeight="bold">
                  {(bookingsData?.averageStayLength || 0).toFixed(1)} nights
                </Text>
              </HStack>
              <HStack justify="space-between">
                <Text color="gray.600">Avg Booking Value</Text>
                <Text fontWeight="bold">
                  {formatCurrency(bookingsData?.averageBookingValue || 0)}
                </Text>
              </HStack>
              <HStack justify="space-between">
                <Text color="gray.600">Lead Time</Text>
                <Text fontWeight="bold">
                  {(bookingsData?.averageLeadTime || 0).toFixed(0)} days
                </Text>
              </HStack>
            </VStack>
          </CardBody>
        </Card>
      </SimpleGrid>
    </Box>
  );
}
