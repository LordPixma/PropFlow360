import {
  Box,
  Grid,
  GridItem,
  Text,
  HStack,
  VStack,
  Badge,
  Tooltip,
  useColorModeValue,
} from '@chakra-ui/react';
import { useMemo } from 'react';

interface CalendarBlock {
  id: string;
  unitId?: string;
  unitName?: string;
  blockType: string;
  startDate: string;
  endDate: string;
  bookingId?: string;
  notes?: string;
}

interface CalendarGridProps {
  startDate: string;
  endDate: string;
  blocks: CalendarBlock[];
  onDateClick?: (date: string) => void;
  onBlockClick?: (block: CalendarBlock) => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const blockTypeColors: Record<string, { bg: string; border: string; text: string }> = {
  booking: { bg: 'blue.100', border: 'blue.400', text: 'blue.700' },
  hold: { bg: 'yellow.100', border: 'yellow.400', text: 'yellow.700' },
  blocked: { bg: 'gray.100', border: 'gray.400', text: 'gray.700' },
  maintenance: { bg: 'orange.100', border: 'orange.400', text: 'orange.700' },
  owner_use: { bg: 'purple.100', border: 'purple.400', text: 'purple.700' },
};

const blockTypeLabels: Record<string, string> = {
  booking: 'Booked',
  hold: 'On Hold',
  blocked: 'Blocked',
  maintenance: 'Maintenance',
  owner_use: 'Owner Use',
};

function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function getMonthName(date: Date): string {
  return date.toLocaleString('default', { month: 'long', year: 'numeric' });
}

export function CalendarGrid({
  startDate,
  endDate,
  blocks,
  onDateClick,
  onBlockClick,
}: CalendarGridProps) {
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const todayBg = useColorModeValue('brand.50', 'brand.900');

  const { weeks, monthLabel } = useMemo(() => {
    const start = parseDate(startDate);
    const end = parseDate(endDate);
    const today = formatDate(new Date());

    // Adjust start to beginning of week
    const calendarStart = new Date(start);
    calendarStart.setDate(calendarStart.getDate() - calendarStart.getDay());

    // Build weeks
    const weeks: Array<Array<{ date: string; dayOfMonth: number; isCurrentMonth: boolean; isToday: boolean }>> = [];
    let currentDate = new Date(calendarStart);

    while (currentDate <= end || weeks.length < 5) {
      const week: typeof weeks[0] = [];

      for (let i = 0; i < 7; i++) {
        const dateStr = formatDate(currentDate);
        week.push({
          date: dateStr,
          dayOfMonth: currentDate.getDate(),
          isCurrentMonth: currentDate >= start && currentDate < end,
          isToday: dateStr === today,
        });
        currentDate = addDays(currentDate, 1);
      }

      weeks.push(week);

      if (currentDate > end && weeks.length >= 5) break;
    }

    return {
      weeks,
      monthLabel: getMonthName(start),
    };
  }, [startDate, endDate]);

  // Build a map of date -> blocks for quick lookup
  const blocksByDate = useMemo(() => {
    const map: Record<string, CalendarBlock[]> = {};

    for (const block of blocks) {
      let current = parseDate(block.startDate);
      const end = parseDate(block.endDate);

      while (current < end) {
        const dateStr = formatDate(current);
        if (!map[dateStr]) {
          map[dateStr] = [];
        }
        map[dateStr].push(block);
        current = addDays(current, 1);
      }
    }

    return map;
  }, [blocks]);

  return (
    <Box bg={bgColor} borderRadius="lg" borderWidth="1px" borderColor={borderColor} overflow="hidden">
      {/* Month Header */}
      <Box p={4} borderBottomWidth="1px" borderColor={borderColor}>
        <Text fontWeight="bold" fontSize="lg">
          {monthLabel}
        </Text>
      </Box>

      {/* Weekday Headers */}
      <Grid templateColumns="repeat(7, 1fr)" bg="gray.50" borderBottomWidth="1px" borderColor={borderColor}>
        {WEEKDAYS.map((day) => (
          <GridItem key={day} p={2} textAlign="center">
            <Text fontSize="sm" fontWeight="medium" color="gray.600">
              {day}
            </Text>
          </GridItem>
        ))}
      </Grid>

      {/* Calendar Days */}
      {weeks.map((week, weekIdx) => (
        <Grid
          key={weekIdx}
          templateColumns="repeat(7, 1fr)"
          borderBottomWidth={weekIdx < weeks.length - 1 ? '1px' : 0}
          borderColor={borderColor}
        >
          {week.map((day) => {
            const dayBlocks = blocksByDate[day.date] || [];
            const hasBlocks = dayBlocks.length > 0;

            return (
              <GridItem
                key={day.date}
                minH="80px"
                p={1}
                borderRightWidth="1px"
                borderColor={borderColor}
                bg={day.isToday ? todayBg : undefined}
                opacity={day.isCurrentMonth ? 1 : 0.4}
                cursor={onDateClick ? 'pointer' : undefined}
                _hover={onDateClick ? { bg: 'gray.50' } : undefined}
                _last={{ borderRightWidth: 0 }}
                onClick={() => onDateClick?.(day.date)}
              >
                <VStack align="stretch" spacing={1}>
                  <Text
                    fontSize="sm"
                    fontWeight={day.isToday ? 'bold' : 'normal'}
                    color={day.isToday ? 'brand.600' : 'gray.700'}
                  >
                    {day.dayOfMonth}
                  </Text>

                  {hasBlocks && (
                    <VStack align="stretch" spacing={0.5}>
                      {dayBlocks.slice(0, 2).map((block, idx) => {
                        const colors = blockTypeColors[block.blockType] || blockTypeColors.blocked;
                        const isStart = block.startDate === day.date;

                        return (
                          <Tooltip
                            key={`${block.id}-${idx}`}
                            label={`${blockTypeLabels[block.blockType] || block.blockType}${block.notes ? `: ${block.notes}` : ''}`}
                            hasArrow
                          >
                            <Box
                              px={1}
                              py={0.5}
                              bg={colors.bg}
                              borderLeftWidth={isStart ? '3px' : 0}
                              borderLeftColor={colors.border}
                              borderRadius={isStart ? 'sm' : 0}
                              cursor={onBlockClick ? 'pointer' : undefined}
                              onClick={(e) => {
                                e.stopPropagation();
                                onBlockClick?.(block);
                              }}
                            >
                              <Text
                                fontSize="xs"
                                color={colors.text}
                                noOfLines={1}
                              >
                                {isStart ? blockTypeLabels[block.blockType] : ''}
                              </Text>
                            </Box>
                          </Tooltip>
                        );
                      })}

                      {dayBlocks.length > 2 && (
                        <Text fontSize="xs" color="gray.500">
                          +{dayBlocks.length - 2} more
                        </Text>
                      )}
                    </VStack>
                  )}
                </VStack>
              </GridItem>
            );
          })}
        </Grid>
      ))}
    </Box>
  );
}
