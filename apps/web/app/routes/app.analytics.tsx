import { useState } from 'react';
import {
  Box,
  Heading,
  SimpleGrid,
  Card,
  CardBody,
  CardHeader,
  Select,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  Flex,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Text,
  VStack,
  HStack,
  Spinner,
  Alert,
  AlertIcon,
} from '@chakra-ui/react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { useApi } from '../hooks/useApi';
import { api } from '../lib/api';
import { formatCurrency, formatPercentage, formatDate } from '../utils/format';

const COLORS = ['#3182CE', '#38A169', '#DD6B20', '#805AD5', '#D69E2E'];

export default function Analytics() {
  const [period, setPeriod] = useState('last_30_days');

  const { data: overview, loading: overviewLoading, error: overviewError } = useApi(
    () => api.analytics.getDashboard(period),
    [period]
  );

  const { data: revenue, loading: revenueLoading } = useApi(
    () => api.analytics.getRevenue(period),
    [period]
  );

  const { data: occupancy, loading: occupancyLoading } = useApi(
    () => api.analytics.getOccupancy(period),
    [period]
  );

  const { data: bookings, loading: bookingsLoading } = useApi(
    () => api.analytics.getBookings(period),
    [period]
  );

  const { data: monthlyData, loading: monthlyLoading } = useApi(
    () => api.analytics.getMonthlyComparison(12),
    []
  );

  const loading = overviewLoading || revenueLoading || occupancyLoading || bookingsLoading;

  if (overviewError) {
    return (
      <Alert status="error">
        <AlertIcon />
        {overviewError.message || 'Failed to load analytics'}
      </Alert>
    );
  }

  const summary = overview?.summary || {};
  const revenueChart = revenue?.chartData || [];
  const occupancyChart = occupancy?.chartData || [];
  const revenueBreakdown = revenue?.breakdown || [];
  const monthlyChart = monthlyData?.comparison || [];

  return (
    <Box>
      <Flex justify="space-between" align="center" mb={6}>
        <Box>
          <Heading size="lg">Analytics</Heading>
          <Text color="gray.600" mt={1}>
            Detailed performance insights and metrics
          </Text>
        </Box>
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

      {loading ? (
        <Flex justify="center" align="center" h="400px">
          <Spinner size="xl" color="brand.500" />
        </Flex>
      ) : (
        <Tabs colorScheme="brand">
          <TabList>
            <Tab>Revenue</Tab>
            <Tab>Occupancy</Tab>
            <Tab>Bookings</Tab>
            <Tab>Trends</Tab>
          </TabList>

          <TabPanels>
            {/* Revenue Tab */}
            <TabPanel px={0}>
              <VStack spacing={6} align="stretch">
                {/* Revenue Stats */}
                <SimpleGrid columns={{ base: 1, md: 4 }} spacing={4}>
                  <Card>
                    <CardBody>
                      <Stat>
                        <StatLabel>Total Revenue</StatLabel>
                        <StatNumber>{formatCurrency(summary.totalRevenue || 0)}</StatNumber>
                        <StatHelpText>
                          {summary.revenueChange !== undefined && (
                            <>
                              <StatArrow type={summary.revenueChange >= 0 ? 'increase' : 'decrease'} />
                              {formatPercentage(Math.abs(summary.revenueChange))}
                            </>
                          )}
                        </StatHelpText>
                      </Stat>
                    </CardBody>
                  </Card>

                  <Card>
                    <CardBody>
                      <Stat>
                        <StatLabel>ADR (Avg Daily Rate)</StatLabel>
                        <StatNumber>{formatCurrency(summary.adr || 0)}</StatNumber>
                        <StatHelpText>Per occupied room</StatHelpText>
                      </Stat>
                    </CardBody>
                  </Card>

                  <Card>
                    <CardBody>
                      <Stat>
                        <StatLabel>RevPAR</StatLabel>
                        <StatNumber>{formatCurrency(summary.revpar || 0)}</StatNumber>
                        <StatHelpText>Revenue per available room</StatHelpText>
                      </Stat>
                    </CardBody>
                  </Card>

                  <Card>
                    <CardBody>
                      <Stat>
                        <StatLabel>Avg Booking Value</StatLabel>
                        <StatNumber>{formatCurrency(bookings?.averageBookingValue || 0)}</StatNumber>
                        <StatHelpText>Per booking</StatHelpText>
                      </Stat>
                    </CardBody>
                  </Card>
                </SimpleGrid>

                {/* Revenue Trend */}
                <Card>
                  <CardHeader>
                    <Heading size="md">Revenue Trend</Heading>
                  </CardHeader>
                  <CardBody>
                    <ResponsiveContainer width="100%" height={350}>
                      <LineChart data={revenueChart}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tickFormatter={(date) => formatDate(date).split(',')[0]} />
                        <YAxis tickFormatter={(value) => `$${value}`} />
                        <Tooltip
                          formatter={(value: any) => formatCurrency(value)}
                          labelFormatter={(date) => formatDate(date)}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="revenue" stroke="#3182CE" strokeWidth={2} name="Revenue" />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardBody>
                </Card>

                {/* Revenue by Property */}
                {revenueBreakdown.length > 0 && (
                  <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
                    <Card>
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
                            <Bar dataKey="revenue" fill="#3182CE" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardBody>
                    </Card>

                    <Card>
                      <CardHeader>
                        <Heading size="md">Revenue Distribution</Heading>
                      </CardHeader>
                      <CardBody>
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              data={revenueBreakdown}
                              dataKey="revenue"
                              nameKey="propertyName"
                              cx="50%"
                              cy="50%"
                              outerRadius={100}
                              label={(entry) => entry.propertyName}
                            >
                              {revenueBreakdown.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value: any) => formatCurrency(value)} />
                          </PieChart>
                        </ResponsiveContainer>
                      </CardBody>
                    </Card>
                  </SimpleGrid>
                )}
              </VStack>
            </TabPanel>

            {/* Occupancy Tab */}
            <TabPanel px={0}>
              <VStack spacing={6} align="stretch">
                {/* Occupancy Stats */}
                <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                  <Card>
                    <CardBody>
                      <Stat>
                        <StatLabel>Average Occupancy</StatLabel>
                        <StatNumber>{formatPercentage(summary.averageOccupancy || 0)}</StatNumber>
                        <StatHelpText>
                          {summary.occupancyChange !== undefined && (
                            <>
                              <StatArrow type={summary.occupancyChange >= 0 ? 'increase' : 'decrease'} />
                              {formatPercentage(Math.abs(summary.occupancyChange))}
                            </>
                          )}
                        </StatHelpText>
                      </Stat>
                    </CardBody>
                  </Card>

                  <Card>
                    <CardBody>
                      <Stat>
                        <StatLabel>Total Bookings</StatLabel>
                        <StatNumber>{summary.totalBookings || 0}</StatNumber>
                        <StatHelpText>In selected period</StatHelpText>
                      </Stat>
                    </CardBody>
                  </Card>

                  <Card>
                    <CardBody>
                      <Stat>
                        <StatLabel>Avg Stay Length</StatLabel>
                        <StatNumber>{(bookings?.averageStayLength || 0).toFixed(1)} nights</StatNumber>
                        <StatHelpText>Per booking</StatHelpText>
                      </Stat>
                    </CardBody>
                  </Card>
                </SimpleGrid>

                {/* Occupancy Trend */}
                <Card>
                  <CardHeader>
                    <Heading size="md">Occupancy Rate Trend</Heading>
                  </CardHeader>
                  <CardBody>
                    <ResponsiveContainer width="100%" height={350}>
                      <LineChart data={occupancyChart}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tickFormatter={(date) => formatDate(date).split(',')[0]} />
                        <YAxis tickFormatter={(value) => `${value}%`} />
                        <Tooltip
                          formatter={(value: any) => formatPercentage(value)}
                          labelFormatter={(date) => formatDate(date)}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="occupancyRate" stroke="#38A169" strokeWidth={2} name="Occupancy %" />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardBody>
                </Card>
              </VStack>
            </TabPanel>

            {/* Bookings Tab */}
            <TabPanel px={0}>
              <VStack spacing={6} align="stretch">
                {/* Booking Stats */}
                <SimpleGrid columns={{ base: 1, md: 4 }} spacing={4}>
                  <Card>
                    <CardBody>
                      <Stat>
                        <StatLabel>New Bookings</StatLabel>
                        <StatNumber>{bookings?.newBookings || 0}</StatNumber>
                        <StatHelpText>In selected period</StatHelpText>
                      </Stat>
                    </CardBody>
                  </Card>

                  <Card>
                    <CardBody>
                      <Stat>
                        <StatLabel>Cancellations</StatLabel>
                        <StatNumber color="red.500">{bookings?.cancellations || 0}</StatNumber>
                        <StatHelpText>
                          {formatPercentage(bookings?.cancellationRate || 0)} rate
                        </StatHelpText>
                      </Stat>
                    </CardBody>
                  </Card>

                  <Card>
                    <CardBody>
                      <Stat>
                        <StatLabel>New Guests</StatLabel>
                        <StatNumber color="green.500">{bookings?.newGuests || 0}</StatNumber>
                        <StatHelpText>First time bookers</StatHelpText>
                      </Stat>
                    </CardBody>
                  </Card>

                  <Card>
                    <CardBody>
                      <Stat>
                        <StatLabel>Avg Lead Time</StatLabel>
                        <StatNumber>{(bookings?.averageLeadTime || 0).toFixed(0)} days</StatNumber>
                        <StatHelpText>Booking to check-in</StatHelpText>
                      </Stat>
                    </CardBody>
                  </Card>
                </SimpleGrid>

                {/* Guest Stats */}
                <Card>
                  <CardHeader>
                    <Heading size="md">Guest Breakdown</Heading>
                  </CardHeader>
                  <CardBody>
                    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={8}>
                      <VStack align="stretch" spacing={3}>
                        <HStack justify="space-between" p={3} bg="green.50" rounded="md">
                          <Text fontWeight="medium">New Guests</Text>
                          <Text fontWeight="bold" fontSize="2xl" color="green.600">
                            {bookings?.newGuests || 0}
                          </Text>
                        </HStack>
                        <HStack justify="space-between" p={3} bg="blue.50" rounded="md">
                          <Text fontWeight="medium">Returning Guests</Text>
                          <Text fontWeight="bold" fontSize="2xl" color="blue.600">
                            {bookings?.returningGuests || 0}
                          </Text>
                        </HStack>
                      </VStack>

                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'New Guests', value: bookings?.newGuests || 0 },
                              { name: 'Returning', value: bookings?.returningGuests || 0 },
                            ]}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            label
                          >
                            <Cell fill={COLORS[1]} />
                            <Cell fill={COLORS[0]} />
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </SimpleGrid>
                  </CardBody>
                </Card>
              </VStack>
            </TabPanel>

            {/* Trends Tab */}
            <TabPanel px={0}>
              <VStack spacing={6} align="stretch">
                <Card>
                  <CardHeader>
                    <Heading size="md">12-Month Comparison</Heading>
                  </CardHeader>
                  <CardBody>
                    {monthlyLoading ? (
                      <Flex justify="center" align="center" h="300px">
                        <Spinner size="lg" color="brand.500" />
                      </Flex>
                    ) : (
                      <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={monthlyChart}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis yAxisId="left" tickFormatter={(value) => `$${value}`} />
                          <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => `${value}%`} />
                          <Tooltip
                            formatter={(value: any, name: string) => {
                              if (name === 'revenue') return formatCurrency(value);
                              if (name === 'occupancyRate') return formatPercentage(value);
                              return value;
                            }}
                          />
                          <Legend />
                          <Bar yAxisId="left" dataKey="revenue" fill="#3182CE" name="Revenue" />
                          <Bar yAxisId="right" dataKey="occupancyRate" fill="#38A169" name="Occupancy %" />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardBody>
                </Card>
              </VStack>
            </TabPanel>
          </TabPanels>
        </Tabs>
      )}
    </Box>
  );
}
