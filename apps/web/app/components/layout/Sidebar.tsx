import {
  Box,
  VStack,
  HStack,
  Icon,
  Text,
  Flex,
  Divider,
  Avatar,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  useColorModeValue,
} from '@chakra-ui/react';
import { Link, useLocation } from '@remix-run/react';
import {
  FiHome,
  FiGrid,
  FiCalendar,
  FiUsers,
  FiFileText,
  FiDollarSign,
  FiTool,
  FiBarChart2,
  FiSettings,
  FiLogOut,
  FiChevronDown,
} from 'react-icons/fi';
import type { IconType } from 'react-icons';

interface NavItem {
  label: string;
  icon: IconType;
  href: string;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: FiHome, href: '/app/dashboard' },
  { label: 'Properties', icon: FiGrid, href: '/app/properties' },
  { label: 'Calendar', icon: FiCalendar, href: '/app/calendar' },
  { label: 'Bookings', icon: FiUsers, href: '/app/bookings' },
  { label: 'Leases', icon: FiFileText, href: '/app/leases' },
  { label: 'Finances', icon: FiDollarSign, href: '/app/finances' },
  { label: 'Maintenance', icon: FiTool, href: '/app/maintenance' },
  { label: 'Reports', icon: FiBarChart2, href: '/app/reports' },
  { label: 'Settings', icon: FiSettings, href: '/app/settings' },
];

interface SidebarProps {
  user?: {
    name: string;
    email: string;
    avatarUrl?: string;
  };
  tenantName?: string;
}

export function Sidebar({ user, tenantName }: SidebarProps) {
  const location = useLocation();
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const activeColor = useColorModeValue('brand.50', 'brand.900');
  const activeBorderColor = useColorModeValue('brand.500', 'brand.300');

  return (
    <Box
      w="250px"
      bg={bgColor}
      borderRight="1px"
      borderColor={borderColor}
      h="100vh"
      position="fixed"
      left={0}
      top={0}
      display="flex"
      flexDirection="column"
    >
      {/* Logo */}
      <Flex h="16" align="center" px={4} borderBottom="1px" borderColor={borderColor}>
        <Text fontSize="xl" fontWeight="bold" color="brand.600">
          PropFlow360
        </Text>
      </Flex>

      {/* Tenant Selector */}
      {tenantName && (
        <Box px={4} py={3} borderBottom="1px" borderColor={borderColor}>
          <Text fontSize="xs" color="gray.500" mb={1}>
            Organization
          </Text>
          <Text fontSize="sm" fontWeight="medium" noOfLines={1}>
            {tenantName}
          </Text>
        </Box>
      )}

      {/* Navigation */}
      <VStack flex={1} align="stretch" py={4} px={2} spacing={1} overflowY="auto">
        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.href);
          return (
            <Link key={item.href} to={item.href}>
              <HStack
                px={3}
                py={2}
                rounded="md"
                bg={isActive ? activeColor : 'transparent'}
                borderLeft="3px solid"
                borderColor={isActive ? activeBorderColor : 'transparent'}
                color={isActive ? 'brand.600' : 'gray.600'}
                _hover={{
                  bg: isActive ? activeColor : 'gray.50',
                }}
                transition="all 0.2s"
              >
                <Icon as={item.icon} boxSize={5} />
                <Text fontSize="sm" fontWeight={isActive ? 'medium' : 'normal'}>
                  {item.label}
                </Text>
              </HStack>
            </Link>
          );
        })}
      </VStack>

      {/* User Menu */}
      {user && (
        <Box px={2} py={3} borderTop="1px" borderColor={borderColor}>
          <Menu>
            <MenuButton
              w="full"
              px={3}
              py={2}
              rounded="md"
              _hover={{ bg: 'gray.50' }}
              transition="all 0.2s"
            >
              <HStack justify="space-between">
                <HStack>
                  <Avatar size="sm" name={user.name} src={user.avatarUrl} />
                  <Box textAlign="left">
                    <Text fontSize="sm" fontWeight="medium" noOfLines={1}>
                      {user.name}
                    </Text>
                    <Text fontSize="xs" color="gray.500" noOfLines={1}>
                      {user.email}
                    </Text>
                  </Box>
                </HStack>
                <Icon as={FiChevronDown} boxSize={4} color="gray.400" />
              </HStack>
            </MenuButton>
            <MenuList>
              <MenuItem as={Link} to="/app/profile">
                Profile
              </MenuItem>
              <MenuItem as={Link} to="/app/settings">
                Settings
              </MenuItem>
              <Divider />
              <MenuItem as={Link} to="/logout" icon={<Icon as={FiLogOut} />}>
                Sign Out
              </MenuItem>
            </MenuList>
          </Menu>
        </Box>
      )}
    </Box>
  );
}
