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
import { Form, Link, useActionData, useNavigation, useSearchParams } from '@remix-run/react';
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
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const redirectTo = formData.get('redirectTo') as string || '/app/dashboard';

  // Basic validation
  const errors: Record<string, string> = {};
  if (!email || !email.includes('@')) {
    errors.email = 'Valid email is required';
  }
  if (!password || password.length < 6) {
    errors.password = 'Password must be at least 6 characters';
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
    }>('/auth/login', { email, password });

    if (result.success && result.data) {
      const session = await getSession(request, context);
      session.set('accessToken', result.data.accessToken);
      session.set('refreshToken', result.data.refreshToken);
      session.set('user', result.data.user);

      return redirect(redirectTo, {
        headers: {
          'Set-Cookie': await commitSession(session, context),
        },
      });
    }

    return json<ActionData>({ error: result.error?.message || 'Invalid credentials' }, { status: 401 });
  } catch (error) {
    console.error('Login error:', error);
    return json<ActionData>({ error: 'Login failed. Please try again.' }, { status: 500 });
  }
}

export default function Login() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const isSubmitting = navigation.state === 'submitting';
  const redirectTo = searchParams.get('redirectTo') || '/app/dashboard';

  return (
    <Box minH="100vh" bg="gray.50" py={20}>
      <Container maxW="md">
        <VStack spacing={8}>
          <VStack spacing={2} textAlign="center">
            <Heading size="xl" color="brand.600">
              PropFlow360
            </Heading>
            <Text color="gray.600">Sign in to your account</Text>
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
                <input type="hidden" name="redirectTo" value={redirectTo} />
                <VStack spacing={4}>
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

                  <FormControl isRequired isInvalid={!!actionData?.errors?.password}>
                    <FormLabel>Password</FormLabel>
                    <Input
                      name="password"
                      type="password"
                      placeholder="••••••••"
                      autoComplete="current-password"
                    />
                    {actionData?.errors?.password && (
                      <FormErrorMessage>{actionData.errors.password}</FormErrorMessage>
                    )}
                  </FormControl>

                  <Button
                    type="submit"
                    colorScheme="brand"
                    w="full"
                    isLoading={isSubmitting}
                  >
                    Sign In
                  </Button>
                </VStack>
              </Form>

              <Text mt={6} textAlign="center" color="gray.600">
                Don't have an account?{' '}
                <ChakraLink as={Link} to="/register" color="brand.600" fontWeight="medium">
                  Sign up
                </ChakraLink>
              </Text>
            </CardBody>
          </Card>
        </VStack>
      </Container>
    </Box>
  );
}
