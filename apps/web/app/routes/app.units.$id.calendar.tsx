import {
  Box,
  Heading,
  Card,
  CardBody,
  HStack,
  Button,
  Icon,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Flex,
  IconButton,
  Alert,
  AlertIcon,
  useDisclosure,
  Text,
  Badge,
  Spinner,
  Center,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  useToast,
} from '@chakra-ui/react';
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/cloudflare';
import { json } from '@remix-run/cloudflare';
import { Link, useLoaderData, useParams, useActionData, useNavigation, useSearchParams, useSubmit } from '@remix-run/react';
import {
  FiChevronLeft,
  FiChevronRight,
  FiPlus,
  FiLink,
  FiCopy,
  FiRefreshCw,
} from 'react-icons/fi';
import { useState, useEffect } from 'react';
import { createApiClient } from '~/lib/api.server';
import { getSession } from '~/lib/session.server';
import { CalendarGrid, BlockModal } from '~/components/calendar';

interface Unit {
  id: string;
  name: string;
  propertyId: string;
  propertyName: string;
}

interface CalendarBlock {
  id: string;
  blockType: string;
  startDate: string;
  endDate: string;
  bookingId?: string;
  notes?: string;
}

interface LoaderData {
  unit: Unit | null;
  blocks: CalendarBlock[];
  startDate: string;
  endDate: string;
  icsUrl?: string;
  error?: string;
}

interface ActionData {
  success?: boolean;
  error?: string;
  icsUrl?: string;
}

function getMonthRange(offset: number = 0): { startDate: string; endDate: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);

  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  };
}

export async function loader({ request, context, params }: LoaderFunctionArgs) {
  const session = await getSession(request, context);
  const accessToken = session.get('accessToken');

  if (!accessToken) {
    return json<LoaderData>({
      unit: null,
      blocks: [],
      ...getMonthRange(),
      error: 'Not authenticated',
    });
  }

  const url = new URL(request.url);
  const monthOffset = parseInt(url.searchParams.get('month') || '0');
  const { startDate, endDate } = getMonthRange(monthOffset);

  try {
    const api = createApiClient(context, accessToken);

    // Fetch unit details
    const unitRes = await api.get<any>(`/units/${params.id}`);

    if (!unitRes.success || !unitRes.data) {
      return json<LoaderData>({
        unit: null,
        blocks: [],
        startDate,
        endDate,
        error: 'Unit not found',
      });
    }

    // Fetch calendar blocks
    const calendarRes = await api.get<any>('/calendar', {
      unitId: params.id!,
      startDate,
      endDate,
    });

    return json<LoaderData>({
      unit: {
        id: unitRes.data.id,
        name: unitRes.data.name,
        propertyId: unitRes.data.propertyId,
        propertyName: unitRes.data.propertyName || 'Property',
      },
      blocks: calendarRes.data?.blocks || [],
      startDate,
      endDate,
    });
  } catch (error) {
    console.error('Calendar loader error:', error);
    return json<LoaderData>({
      unit: null,
      blocks: [],
      ...getMonthRange(),
      error: 'Failed to load calendar',
    });
  }
}

export async function action({ request, context, params }: ActionFunctionArgs) {
  const session = await getSession(request, context);
  const accessToken = session.get('accessToken');

  if (!accessToken) {
    return json<ActionData>({ error: 'Not authenticated' }, { status: 401 });
  }

  const formData = await request.formData();
  const intent = formData.get('intent');

  const api = createApiClient(context, accessToken);

  try {
    switch (intent) {
      case 'createBlock': {
        const result = await api.post('/calendar/blocks', {
          unitId: params.id,
          blockType: formData.get('blockType'),
          startDate: formData.get('startDate'),
          endDate: formData.get('endDate'),
          notes: formData.get('notes') || undefined,
        });

        if (!result.success) {
          return json<ActionData>({ error: result.error?.message || 'Failed to create block' });
        }

        return json<ActionData>({ success: true });
      }

      case 'deleteBlock': {
        const blockId = formData.get('blockId');
        const result = await api.delete(`/calendar/blocks/${blockId}`);

        if (!result.success) {
          return json<ActionData>({ error: result.error?.message || 'Failed to delete block' });
        }

        return json<ActionData>({ success: true });
      }

      case 'generateIcsUrl': {
        const result = await api.post<{ url: string }>(`/calendar/ics/${params.id}/token`);

        if (!result.success) {
          return json<ActionData>({ error: result.error?.message || 'Failed to generate ICS URL' });
        }

        return json<ActionData>({ success: true, icsUrl: result.data?.url });
      }

      default:
        return json<ActionData>({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Calendar action error:', error);
    return json<ActionData>({ error: 'Action failed' }, { status: 500 });
  }
}

export default function UnitCalendar() {
  const { id } = useParams();
  const { unit, blocks, startDate, endDate, error } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [searchParams, setSearchParams] = useSearchParams();
  const submit = useSubmit();
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();

  const [selectedDate, setSelectedDate] = useState<string | undefined>();
  const [icsUrl, setIcsUrl] = useState<string | undefined>(actionData?.icsUrl);

  const monthOffset = parseInt(searchParams.get('month') || '0');

  useEffect(() => {
    if (actionData?.icsUrl) {
      setIcsUrl(actionData.icsUrl);
    }
  }, [actionData?.icsUrl]);

  const handlePrevMonth = () => {
    setSearchParams({ month: String(monthOffset - 1) });
  };

  const handleNextMonth = () => {
    setSearchParams({ month: String(monthOffset + 1) });
  };

  const handleToday = () => {
    setSearchParams({});
  };

  const handleDateClick = (date: string) => {
    setSelectedDate(date);
    onOpen();
  };

  const handleCopyIcsUrl = async () => {
    if (icsUrl) {
      await navigator.clipboard.writeText(icsUrl);
      toast({
        title: 'Copied!',
        description: 'ICS URL copied to clipboard',
        status: 'success',
        duration: 2000,
      });
    }
  };

  const handleGenerateIcsUrl = () => {
    const formData = new FormData();
    formData.set('intent', 'generateIcsUrl');
    submit(formData, { method: 'post' });
  };

  if (error || !unit) {
    return (
      <Box>
        <Alert status="error">
          <AlertIcon />
          {error || 'Unit not found'}
        </Alert>
      </Box>
    );
  }

  const monthLabel = new Date(startDate).toLocaleString('default', { month: 'long', year: 'numeric' });

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
        <BreadcrumbItem>
          <BreadcrumbLink as={Link} to={`/app/units/${id}`}>
            {unit.name}
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>
          <BreadcrumbLink>Calendar</BreadcrumbLink>
        </BreadcrumbItem>
      </Breadcrumb>

      {/* Header */}
      <Flex justify="space-between" align="center" mb={6}>
        <Heading size="lg">{unit.name} - Calendar</Heading>
        <HStack spacing={3}>
          <Menu>
            <MenuButton as={Button} leftIcon={<Icon as={FiLink} />} variant="outline">
              ICS Feed
            </MenuButton>
            <MenuList>
              {icsUrl ? (
                <>
                  <Box px={3} py={2}>
                    <Text fontSize="sm" color="gray.600" mb={2}>
                      ICS Calendar URL:
                    </Text>
                    <InputGroup size="sm">
                      <Input value={icsUrl} isReadOnly fontSize="xs" />
                    </InputGroup>
                  </Box>
                  <MenuItem icon={<Icon as={FiCopy} />} onClick={handleCopyIcsUrl}>
                    Copy URL
                  </MenuItem>
                  <MenuItem icon={<Icon as={FiRefreshCw} />} onClick={handleGenerateIcsUrl}>
                    Regenerate URL
                  </MenuItem>
                </>
              ) : (
                <MenuItem icon={<Icon as={FiLink} />} onClick={handleGenerateIcsUrl}>
                  Generate ICS URL
                </MenuItem>
              )}
            </MenuList>
          </Menu>
          <Button leftIcon={<Icon as={FiPlus} />} colorScheme="brand" onClick={onOpen}>
            Block Dates
          </Button>
        </HStack>
      </Flex>

      {/* Calendar Navigation */}
      <Card mb={6}>
        <CardBody py={3}>
          <Flex justify="space-between" align="center">
            <HStack>
              <IconButton
                aria-label="Previous month"
                icon={<Icon as={FiChevronLeft} />}
                variant="ghost"
                onClick={handlePrevMonth}
              />
              <Button variant="ghost" onClick={handleToday}>
                Today
              </Button>
              <IconButton
                aria-label="Next month"
                icon={<Icon as={FiChevronRight} />}
                variant="ghost"
                onClick={handleNextMonth}
              />
            </HStack>

            <Heading size="md">{monthLabel}</Heading>

            <HStack spacing={4}>
              <HStack spacing={2}>
                <Badge colorScheme="blue">Booked</Badge>
                <Badge colorScheme="gray">Blocked</Badge>
                <Badge colorScheme="orange">Maintenance</Badge>
                <Badge colorScheme="purple">Owner</Badge>
              </HStack>
            </HStack>
          </Flex>
        </CardBody>
      </Card>

      {/* Calendar Grid */}
      {navigation.state === 'loading' ? (
        <Center py={10}>
          <Spinner size="lg" color="brand.500" />
        </Center>
      ) : (
        <CalendarGrid
          startDate={startDate}
          endDate={endDate}
          blocks={blocks}
          onDateClick={handleDateClick}
        />
      )}

      {/* Block Modal */}
      <BlockModal
        isOpen={isOpen}
        onClose={() => {
          onClose();
          setSelectedDate(undefined);
        }}
        unitId={unit.id}
        unitName={unit.name}
        initialDate={selectedDate}
        mode="create"
        error={actionData?.error}
      />
    </Box>
  );
}
