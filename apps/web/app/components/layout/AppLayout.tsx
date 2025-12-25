import { Box, Flex } from '@chakra-ui/react';
import { Sidebar } from './Sidebar';

interface AppLayoutProps {
  children: React.ReactNode;
  user?: {
    name: string;
    email: string;
    avatarUrl?: string;
  };
  tenantName?: string;
}

export function AppLayout({ children, user, tenantName }: AppLayoutProps) {
  return (
    <Flex minH="100vh" bg="gray.50">
      <Sidebar user={user} tenantName={tenantName} />
      <Box ml="250px" flex={1} p={6}>
        {children}
      </Box>
    </Flex>
  );
}
