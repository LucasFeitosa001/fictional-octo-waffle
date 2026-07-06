import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  Button,
  Card,
  Description,
  Input,
  Label,
  Spinner,
  TextField,
  Typography,
} from 'heroui-native';
import { useAuth } from '../lib/auth-context';

export default function LoginScreen() {
  const router = useRouter();
  const { user, loading, signIn, signingIn, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Spinner size="lg" />
      </View>
    );
  }

  if (user) {
    return <Redirect href="/(drawer)" />;
  }

  async function handleSubmit() {
    const ok = await signIn(email.trim(), password);
    if (ok) router.replace('/(drawer)');
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View className="flex-1 justify-center px-6">
        <View className="mb-8 items-center gap-3">
          <Image
            source={require('../assets/brand/beautypass-logo.png')}
            resizeMode="contain"
            style={{ width: 240, height: 72 }}
          />
          <Typography
            color="muted"
            style={{ fontFamily: 'Inter_400Regular' }}
          >
            Sua gestão, seus resultados.
          </Typography>
        </View>

        <Card>
          <Card.Body>
            <View className="gap-4">
              <TextField isRequired>
                <Label>E-mail</Label>
                <Input
                  placeholder="voce@beautypass.dev"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  value={email}
                  onChangeText={setEmail}
                />
              </TextField>

              <TextField isRequired>
                <Label>Senha</Label>
                <View className="w-full flex-row items-center">
                  <Input
                    className="flex-1 pr-10"
                    placeholder="Sua senha"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                    onSubmitEditing={handleSubmit}
                  />
                  <Pressable
                    className="absolute right-3"
                    onPress={() => setShowPassword((v) => !v)}
                    hitSlop={8}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color="#6B6880"
                    />
                  </Pressable>
                </View>
              </TextField>

              {error ? (
                <Description className="text-danger">{error}</Description>
              ) : null}

              <Button
                variant="primary"
                onPress={handleSubmit}
                isDisabled={signingIn || !email || !password}
              >
                {signingIn ? (
                  <Spinner size="sm" color="#FFFFFF" />
                ) : (
                  <Button.Label>Entrar</Button.Label>
                )}
              </Button>
            </View>
          </Card.Body>
        </Card>
      </View>
    </KeyboardAvoidingView>
  );
}
