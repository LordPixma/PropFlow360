import {
  Box,
  Button,
  Card,
  CardBody,
  Container,
  FormControl,
  FormLabel,
  FormErrorMessage,
  Heading,
  Input,
  VStack,
  Text,
  Alert,
  AlertIcon,
  Link as ChakraLink,
} from '@chakra-ui/react';
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/cloudflare';
import { json, redirect } from '@remix-run/cloudflare';
import { Form, Link, useActionData, useNavigation } from '@remix-run/react';
import { createApiClient } from '~/lib/api.server';
import { commitSession, getSession } from '~/lib/session.server';

interface ActionData {
  errors?: Record<string, string>;
  error?: string;
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  const session = await getSession(request, context);
  const accessToken = session.get('accessToken');

  if (accessToken) {
    return redirect('/app/dashboard');
  }

  return json({});
}

export async function action({ request, context }: ActionFunctionArgs) {
  const formData = await request.formData();
  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const confirmPassword = formData.get('confirmPassword') as string;
  const tenantName = formData.get('tenantName') as string;

  // Basic validation
  const errors: Record<string, string> = {};
  if (!name || name.trim().length < 2) {
    errors.name = 'Name must be at least 2 characters';
  }
  if (!email || !email.includes('@')) {
    errors.email = 'Valid email is required';
  }
  if (!password || password.length < 8) {
    errors.password = 'Password must be at least 8 characters';
  }
  if (password !== confirmPassword) {
    errors.confirmPassword = 'Passwords do not match';
  }
  if (!tenantName || tenantName.trim().length < 2) {
    errors.tenantName = 'Company name must be at least 2 characters';
  }

  if (Object.keys(errors).length > 0) {
    return json<ActionData>({ errors }, { status: 400 });
  }

  try {
    const api = createApiClient(context);
    const result = await api.post<{
      accessToken: string;
      refreshToken: string;
      user: { id: string; email: string; name: string };
      tenant: { id: string; name: string };
    }>('/auth/register', { name, email, password, tenantName });

    if (result.success && result.data) {
      const session = await getSession(request, context);
      session.set('accessToken', result.data.accessToken);
      session.set('refreshToken', result.data.refreshToken);
      session.set('user', result.data.user);
      session.set('tenant', result.data.tenant);

      return redirect('/app/dashboard', {
        headers: {
          'Set-Cookie': await commitSession(session, context),
        },
      });
    }

    return json<ActionData>({ error: result.error?.message || 'Registration failed' }, { status: 400 });
  } catch (error) {
    console.error('Registration error:', error);
    return json<ActionData>({ error: 'Registration failed. Please try again.' }, { status: 500 });
  }
}

export default function Register() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  return (
    <Box minH="100vh" bg="gray.50" py={20}>
      <Container maxW="md">
        <VStack spacing={8}>
          <VStack spacing={2} textAlign="center">
            <Heading size="xl" color="brand.600">
              PropFlow360
            </Heading>
            <Text color="gray.600">Create your account</Text>
          </VStack>

          <Card w="full">
            <CardBody>
              {actionData?.error && (
                <Alert status="error" mb={4}>
                  <AlertIcon />
                  {actionData.error}
                </Alert>
              )}

              <Form method="post">
                <VStack spacing={4}>
                  <FormControl isRequired isInvalid={!!actionData?.errors?.name}>
                    <FormLabel>Full Name</FormLabel>
                    <Input
                      name="name"
                      type="text"
                      placeholder="John Smith"
                      autoComplete="name"
                    />
                    {actionData?.errors?.name && (
                      <FormErrorMessage>{actionData.errors.name}</FormErrorMessage>
                    )}
                  </FormControl>

                  <FormControl isRequired isInvalid={!!actionData?.errors?.email}>
                    <FormLabel>Email</FormLabel>
                    <Input
                      name="email"
                      type="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                    />
                    {actionData?.errors?.email && (
                      <FormErrorMessage>{actionData.errors.email}</FormErrorMessage>
                    )}
                  </FormControl>

                  <FormControl isRequired isInvalid={!!actionData?.errors?.tenantName}>
                    <FormLabel>Company / Organisation Name</FormLabel>
                    <Input
                      name="tenantName"
                      type="text"
                      placeholder="Acme Properties Ltd"
                    />
                    {actionData?.errors?.tenantName && (
                      <FormErrorMessage>{actionData.errors.tenantName}</FormErrorMessage>
                    )}
                  </FormControl>

                  <FormControl isRequired isInvalid={!!actionData?.errors?.password}>
                    <FormLabel>Password</FormLabel>
                    <Input
                      name="password"
                      type="password"
                      placeholder="••••••••"
                      autoComplete="new-password"
                    />
                    {actionData?.errors?.password && (
                      <FormErrorMessage>{actionData.errors.password}</FormErrorMessage>
                    )}
                  </FormControl>

                  <FormControl isRequired isInvalid={!!actionData?.errors?.confirmPassword}>
                    <FormLabel>Confirm Password</FormLabel>
                    <Input
                      name="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      autoComplete="new-password"
                    />
                    {actionData?.errors?.confirmPassword && (
                      <FormErrorMessage>{actionData.errors.confirmPassword}</FormErrorMessage>
                    )}
                  </FormControl>

                  <Button
                    type="submit"
                    colorScheme="brand"
                    w="full"
                    isLoading={isSubmitting}
                  >
                    Create Account
                  </Button>
                </VStack>
              </Form>

              <Text mt={6} textAlign="center" color="gray.600">
                Already have an account?{' '}
                <ChakraLink as={Link} to="/login" color="brand.600" fontWeight="medium">
                  Sign in
                </ChakraLink>
              </Text>
            </CardBody>
          </Card>
        </VStack>
      </Container>
    </Box>
  );
}
