import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardBody,
  CardHeader,
  Heading,
  VStack,
  HStack,
  FormControl,
  FormLabel,
  Input,
  Select,
  Switch,
  Button,
  Divider,
  SimpleGrid,
  useToast,
  Spinner,
  Alert,
  AlertIcon,
  Text,
  Textarea,
} from '@chakra-ui/react';
import { api } from '../lib/api';
import { useMutation } from '../hooks/useApi';

export default function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const toast = useToast();

  const { mutate: updateSettings, loading: updating } = useMutation(
    (data: any) => api.admin.updateSettings(data)
  );

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.admin.getSettings();
      setSettings(response.settings);
    } catch (err: any) {
      setError(err.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      await updateSettings(settings);
      toast({
        title: 'Settings saved',
        description: 'Your settings have been updated successfully',
        status: 'success',
        duration: 3000,
      });
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to save settings',
        status: 'error',
        duration: 5000,
      });
    }
  };

  const handleChange = (field: string, value: any) => {
    setSettings((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleFeatureChange = (feature: string, enabled: boolean) => {
    setSettings((prev: any) => ({
      ...prev,
      features: {
        ...prev.features,
        [feature]: enabled,
      },
    }));
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={10}>
        <Spinner size="xl" color="brand.500" />
      </Box>
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

  const features = settings?.features || {};

  return (
    <VStack spacing={6} align="stretch">
      {/* Business Information */}
      <Card>
        <CardHeader>
          <Heading size="md">Business Information</Heading>
        </CardHeader>
        <CardBody>
          <VStack spacing={4} align="stretch">
            <FormControl>
              <FormLabel>Business Name</FormLabel>
              <Input
                value={settings?.businessName || ''}
                onChange={(e) => handleChange('businessName', e.target.value)}
                placeholder="Your Business Name"
              />
            </FormControl>

            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
              <FormControl>
                <FormLabel>Business Email</FormLabel>
                <Input
                  type="email"
                  value={settings?.businessEmail || ''}
                  onChange={(e) => handleChange('businessEmail', e.target.value)}
                  placeholder="contact@business.com"
                />
              </FormControl>

              <FormControl>
                <FormLabel>Business Phone</FormLabel>
                <Input
                  type="tel"
                  value={settings?.businessPhone || ''}
                  onChange={(e) => handleChange('businessPhone', e.target.value)}
                  placeholder="+44 20 1234 5678"
                />
              </FormControl>
            </SimpleGrid>

            <FormControl>
              <FormLabel>Website</FormLabel>
              <Input
                type="url"
                value={settings?.website || ''}
                onChange={(e) => handleChange('website', e.target.value)}
                placeholder="https://www.business.com"
              />
            </FormControl>
          </VStack>
        </CardBody>
      </Card>

      {/* Regional Settings */}
      <Card>
        <CardHeader>
          <Heading size="md">Regional Settings</Heading>
        </CardHeader>
        <CardBody>
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
            <FormControl>
              <FormLabel>Timezone</FormLabel>
              <Select
                value={settings?.timezone || 'UTC'}
                onChange={(e) => handleChange('timezone', e.target.value)}
              >
                <option value="UTC">UTC</option>
                <option value="Europe/London">Europe/London</option>
                <option value="America/New_York">America/New York</option>
                <option value="America/Los_Angeles">America/Los Angeles</option>
                <option value="Asia/Tokyo">Asia/Tokyo</option>
              </Select>
            </FormControl>

            <FormControl>
              <FormLabel>Currency</FormLabel>
              <Select
                value={settings?.currency || 'USD'}
                onChange={(e) => handleChange('currency', e.target.value)}
              >
                <option value="USD">USD - US Dollar</option>
                <option value="GBP">GBP - British Pound</option>
                <option value="EUR">EUR - Euro</option>
                <option value="JPY">JPY - Japanese Yen</option>
              </Select>
            </FormControl>

            <FormControl>
              <FormLabel>Locale</FormLabel>
              <Select
                value={settings?.locale || 'en-US'}
                onChange={(e) => handleChange('locale', e.target.value)}
              >
                <option value="en-US">English (US)</option>
                <option value="en-GB">English (UK)</option>
                <option value="fr-FR">French</option>
                <option value="de-DE">German</option>
                <option value="es-ES">Spanish</option>
              </Select>
            </FormControl>
          </SimpleGrid>
        </CardBody>
      </Card>

      {/* Feature Flags */}
      <Card>
        <CardHeader>
          <Heading size="md">Features</Heading>
          <Text fontSize="sm" color="gray.600" mt={1}>
            Enable or disable features for your account
          </Text>
        </CardHeader>
        <CardBody>
          <VStack spacing={4} align="stretch">
            <HStack justify="space-between">
              <Box>
                <Text fontWeight="medium">Bookings</Text>
                <Text fontSize="sm" color="gray.600">Short-term booking management</Text>
              </Box>
              <Switch
                isChecked={features.bookingsEnabled !== false}
                onChange={(e) => handleFeatureChange('bookingsEnabled', e.target.checked)}
                colorScheme="brand"
              />
            </HStack>

            <Divider />

            <HStack justify="space-between">
              <Box>
                <Text fontWeight="medium">Leases</Text>
                <Text fontSize="sm" color="gray.600">Long-term lease management</Text>
              </Box>
              <Switch
                isChecked={features.leasesEnabled !== false}
                onChange={(e) => handleFeatureChange('leasesEnabled', e.target.checked)}
                colorScheme="brand"
              />
            </HStack>

            <Divider />

            <HStack justify="space-between">
              <Box>
                <Text fontWeight="medium">Payments</Text>
                <Text fontSize="sm" color="gray.600">Payment processing and invoicing</Text>
              </Box>
              <Switch
                isChecked={features.paymentsEnabled !== false}
                onChange={(e) => handleFeatureChange('paymentsEnabled', e.target.checked)}
                colorScheme="brand"
              />
            </HStack>

            <Divider />

            <HStack justify="space-between">
              <Box>
                <Text fontWeight="medium">Maintenance</Text>
                <Text fontSize="sm" color="gray.600">Maintenance ticket system</Text>
              </Box>
              <Switch
                isChecked={features.maintenanceEnabled !== false}
                onChange={(e) => handleFeatureChange('maintenanceEnabled', e.target.checked)}
                colorScheme="brand"
              />
            </HStack>

            <Divider />

            <HStack justify="space-between">
              <Box>
                <Text fontWeight="medium">Channel Manager</Text>
                <Text fontSize="sm" color="gray.600">Multi-channel integrations</Text>
              </Box>
              <Switch
                isChecked={features.channelsEnabled !== false}
                onChange={(e) => handleFeatureChange('channelsEnabled', e.target.checked)}
                colorScheme="brand"
              />
            </HStack>

            <Divider />

            <HStack justify="space-between">
              <Box>
                <Text fontWeight="medium">Analytics</Text>
                <Text fontSize="sm" color="gray.600">Advanced reporting and insights</Text>
              </Box>
              <Switch
                isChecked={features.analyticsEnabled !== false}
                onChange={(e) => handleFeatureChange('analyticsEnabled', e.target.checked)}
                colorScheme="brand"
              />
            </HStack>
          </VStack>
        </CardBody>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <Heading size="md">Notifications</Heading>
        </CardHeader>
        <CardBody>
          <VStack spacing={4} align="stretch">
            <HStack justify="space-between">
              <Box>
                <Text fontWeight="medium">Email Notifications</Text>
                <Text fontSize="sm" color="gray.600">Send notifications via email</Text>
              </Box>
              <Switch
                isChecked={features.emailNotificationsEnabled !== false}
                onChange={(e) => handleFeatureChange('emailNotificationsEnabled', e.target.checked)}
                colorScheme="brand"
              />
            </HStack>

            <Divider />

            <HStack justify="space-between">
              <Box>
                <Text fontWeight="medium">SMS Notifications</Text>
                <Text fontSize="sm" color="gray.600">Send notifications via SMS</Text>
              </Box>
              <Switch
                isChecked={features.smsNotificationsEnabled !== false}
                onChange={(e) => handleFeatureChange('smsNotificationsEnabled', e.target.checked)}
                colorScheme="brand"
              />
            </HStack>
          </VStack>
        </CardBody>
      </Card>

      {/* Actions */}
      <HStack justify="flex-end">
        <Button variant="ghost" onClick={loadSettings}>
          Cancel
        </Button>
        <Button
          colorScheme="brand"
          onClick={handleSave}
          isLoading={updating}
        >
          Save Settings
        </Button>
      </HStack>
    </VStack>
  );
}
