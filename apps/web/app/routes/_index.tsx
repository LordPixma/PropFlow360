import {
  Box,
  Button,
  Container,
  Flex,
  Heading,
  Text,
  VStack,
  HStack,
  Icon,
  SimpleGrid,
  Card,
  CardBody,
} from '@chakra-ui/react';
import { Link } from '@remix-run/react';
import { FiHome, FiCalendar, FiDollarSign, FiBarChart2 } from 'react-icons/fi';

const features = [
  {
    icon: FiHome,
    title: 'Property Management',
    description: 'Manage properties, units, and amenities across your entire portfolio.',
  },
  {
    icon: FiCalendar,
    title: 'Smart Calendar',
    description: 'Real-time availability, bookings, and channel sync in one place.',
  },
  {
    icon: FiDollarSign,
    title: 'Integrated Payments',
    description: 'Secure payments, invoicing, and automated reconciliation.',
  },
  {
    icon: FiBarChart2,
    title: 'Analytics & Reporting',
    description: 'Occupancy rates, revenue insights, and performance metrics.',
  },
];

export default function Index() {
  return (
    <Box minH="100vh" bg="gray.50">
      {/* Header */}
      <Box bg="white" borderBottom="1px" borderColor="gray.200">
        <Container maxW="container.xl" py={4}>
          <Flex justify="space-between" align="center">
            <Heading size="md" color="brand.600">
              PropFlow360
            </Heading>
            <HStack spacing={4}>
              <Button as={Link} to="/login" variant="ghost">
                Sign In
              </Button>
              <Button as={Link} to="/register" colorScheme="brand">
                Get Started
              </Button>
            </HStack>
          </Flex>
        </Container>
      </Box>

      {/* Hero */}
      <Container maxW="container.xl" py={20}>
        <VStack spacing={8} textAlign="center">
          <Heading size="2xl" color="gray.800" maxW="3xl">
            Property Management, Simplified
          </Heading>
          <Text fontSize="xl" color="gray.600" maxW="2xl">
            PropFlow360 is a modern platform for managing short, medium, and long-term lets. From
            bookings to payments, everything in one place.
          </Text>
          <HStack spacing={4}>
            <Button as={Link} to="/register" size="lg" colorScheme="brand">
              Start Free Trial
            </Button>
            <Button as={Link} to="/demo" size="lg" variant="outline">
              View Demo
            </Button>
          </HStack>
        </VStack>
      </Container>

      {/* Features */}
      <Box bg="white" py={20}>
        <Container maxW="container.xl">
          <VStack spacing={12}>
            <VStack spacing={4} textAlign="center">
              <Heading size="xl" color="gray.800">
                Everything You Need
              </Heading>
              <Text fontSize="lg" color="gray.600" maxW="2xl">
                A complete suite of tools for property managers, hosts, and operators.
              </Text>
            </VStack>
            <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={8} w="full">
              {features.map((feature) => (
                <Card key={feature.title} variant="outline">
                  <CardBody>
                    <VStack spacing={4} align="start">
                      <Flex
                        w={12}
                        h={12}
                        align="center"
                        justify="center"
                        rounded="lg"
                        bg="brand.50"
                        color="brand.600"
                      >
                        <Icon as={feature.icon} boxSize={6} />
                      </Flex>
                      <Heading size="md">{feature.title}</Heading>
                      <Text color="gray.600">{feature.description}</Text>
                    </VStack>
                  </CardBody>
                </Card>
              ))}
            </SimpleGrid>
          </VStack>
        </Container>
      </Box>

      {/* Footer */}
      <Box bg="gray.800" color="white" py={12}>
        <Container maxW="container.xl">
          <Flex justify="space-between" align="center" wrap="wrap" gap={4}>
            <Text>2024 PropFlow360. All rights reserved.</Text>
            <HStack spacing={6}>
              <Link to="/privacy">Privacy</Link>
              <Link to="/terms">Terms</Link>
              <Link to="/support">Support</Link>
            </HStack>
          </Flex>
        </Container>
      </Box>
    </Box>
  );
}
