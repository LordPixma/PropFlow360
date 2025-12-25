import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  FormControl,
  FormLabel,
  Input,
  Select,
  Textarea,
  VStack,
  HStack,
  Alert,
  AlertIcon,
} from '@chakra-ui/react';
import { Form, useNavigation } from '@remix-run/react';
import { useState } from 'react';

interface BlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  unitId: string;
  unitName: string;
  initialDate?: string;
  mode: 'create' | 'edit';
  block?: {
    id: string;
    blockType: string;
    startDate: string;
    endDate: string;
    notes?: string;
  };
  error?: string;
}

const blockTypes = [
  { value: 'blocked', label: 'Blocked' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'owner_use', label: 'Owner Use' },
];

export function BlockModal({
  isOpen,
  onClose,
  unitId,
  unitName,
  initialDate,
  mode,
  block,
  error,
}: BlockModalProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  const [startDate, setStartDate] = useState(block?.startDate || initialDate || '');
  const [endDate, setEndDate] = useState(block?.endDate || '');

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStartDate = e.target.value;
    setStartDate(newStartDate);

    // Auto-set end date if not set or if end date is before new start date
    if (!endDate || endDate <= newStartDate) {
      const nextDay = new Date(newStartDate);
      nextDay.setDate(nextDay.getDate() + 1);
      setEndDate(nextDay.toISOString().split('T')[0]);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalOverlay />
      <ModalContent>
        <Form method="post">
          <ModalHeader>
            {mode === 'create' ? 'Block Dates' : 'Edit Block'}
          </ModalHeader>
          <ModalCloseButton />

          <ModalBody>
            {error && (
              <Alert status="error" mb={4}>
                <AlertIcon />
                {error}
              </Alert>
            )}

            <VStack spacing={4}>
              <input type="hidden" name="intent" value={mode === 'create' ? 'createBlock' : 'updateBlock'} />
              <input type="hidden" name="unitId" value={unitId} />
              {block?.id && <input type="hidden" name="blockId" value={block.id} />}

              <FormControl>
                <FormLabel>Unit</FormLabel>
                <Input value={unitName} isReadOnly bg="gray.50" />
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Block Type</FormLabel>
                <Select name="blockType" defaultValue={block?.blockType || 'blocked'}>
                  {blockTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </Select>
              </FormControl>

              <HStack spacing={4} w="full">
                <FormControl isRequired>
                  <FormLabel>Start Date</FormLabel>
                  <Input
                    type="date"
                    name="startDate"
                    value={startDate}
                    onChange={handleStartDateChange}
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel>End Date</FormLabel>
                  <Input
                    type="date"
                    name="endDate"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate}
                  />
                </FormControl>
              </HStack>

              <FormControl>
                <FormLabel>Notes</FormLabel>
                <Textarea
                  name="notes"
                  placeholder="Optional notes..."
                  defaultValue={block?.notes}
                  rows={3}
                />
              </FormControl>
            </VStack>
          </ModalBody>

          <ModalFooter>
            <HStack spacing={3}>
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" colorScheme="brand" isLoading={isSubmitting}>
                {mode === 'create' ? 'Create Block' : 'Save Changes'}
              </Button>
            </HStack>
          </ModalFooter>
        </Form>
      </ModalContent>
    </Modal>
  );
}
