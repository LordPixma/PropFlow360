import { Outlet } from '@remix-run/react';
import {
  Box,
  Heading,
  Tabs,
  TabList,
  Tab,
  Text,
} from '@chakra-ui/react';
import { Link, useLocation } from '@remix-run/react';

export default function AdminLayout() {
  const location = useLocation();

  const tabs = [
    { label: 'Settings', path: '/app/admin/settings' },
    { label: 'Audit Logs', path: '/app/admin/audit' },
    { label: 'API Keys', path: '/app/admin/api-keys' },
    { label: 'Webhooks', path: '/app/admin/webhooks' },
  ];

  const activeIndex = tabs.findIndex(tab => location.pathname.startsWith(tab.path));

  return (
    <Box>
      <Box mb={6}>
        <Heading size="lg">Admin Portal</Heading>
        <Text color="gray.600" mt={1}>
          Manage system settings, security, and integrations
        </Text>
      </Box>

      <Tabs index={activeIndex >= 0 ? activeIndex : 0} colorScheme="brand" mb={6}>
        <TabList>
          {tabs.map((tab) => (
            <Tab key={tab.path} as={Link} to={tab.path}>
              {tab.label}
            </Tab>
          ))}
        </TabList>
      </Tabs>

      <Outlet />
    </Box>
  );
}
