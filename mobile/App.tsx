import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import { API_URL } from "./src/config";

const menu = [
  ["Início", "⌂"],
  ["IA", "✦"],
  ["Pedido", "▣"],
  ["Exames", "◫"],
  ["Perfil", "◉"]
];

export default function App() {
  const [screen, setScreen] = useState("Início");
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem("labia_token").then(setToken);
  }, []);

  async function login() {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      await AsyncStorage.setItem("labia_token", d.token);
      setToken(d.token);
    } catch (e: any) {
      Alert.alert("Login", e.message);
    } finally {
      setLoading(false);
    }
  }

  async function register() {
    if (!name || !email || !password || !inviteCode) {
      return Alert.alert("Erro", "Preencha todos os campos e o código de convite.");
    }
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, inviteCode })
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      Alert.alert("Sucesso", "Conta criada com sucesso! Faça login para continuar.");
      setIsRegistering(false);
    } catch (e: any) {
      Alert.alert("Cadastro", e.message);
    } finally {
      setLoading(false);
    }
  }

  async function generateInvite() {
    if (!token) return;
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/api/admin/invite-codes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        }
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setGeneratedCode(d.inviteCode);
      Alert.alert("Convite Gerado", `Código: ${d.inviteCode}`);
    } catch (e: any) {
      Alert.alert("Erro ao Gerar Convite", e.message);
    } finally {
      setLoading(false);
    }
  }

  async function ask() {
    if (!message.trim() || !token) return;
    const q = message.trim();
    setMessage("");
    setChat((c) => [...c, { role: "user", content: q }]);
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ message: q, history: chat })
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setChat((c) => [...c, { role: "assistant", content: d.text }]);
    } catch (e: any) {
      Alert.alert("LabIA", e.message);
    } finally {
      setLoading(false);
    }
  }

  async function pickOrder() {
    const p = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!p.granted) return Alert.alert("Permissão", "Autorize o acesso às imagens.");
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      base64: true
    });
    if (r.canceled) return;
    const a = r.assets[0];
    setImage(a.uri);
    setLoading(true);
    try {
      const x = await fetch(`${API_URL}/api/analyze-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ base64: a.base64, mimeType: a.mimeType || "image/jpeg" })
      });
      const d = await x.json();
      if (!x.ok) throw Error(d.error);
      setChat((c) => [...c, { role: "assistant", content: d.text }]);
      setScreen("IA");
    } catch (e: any) {
      Alert.alert("Leitor", e.message);
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <Login
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
        name={name}
        setName={setName}
        inviteCode={inviteCode}
        setInviteCode={setInviteCode}
        login={login}
        register={register}
        isRegistering={isRegistering}
        setIsRegistering={setIsRegistering}
        loading={loading}
      />
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="light" />
      <View style={s.header}>
        <View>
          <Text style={s.logo}>LabIA</Text>
          <Text style={s.sub}>Plataforma Profissional</Text>
        </View>
        <View style={s.online}>
          <View style={s.dot} />
          <Text style={s.onlineText}>Seguro</Text>
        </View>
      </View>

      {screen === "Início" && (
        <ScrollView contentContainerStyle={s.body}>
          <Text style={s.h1}>Central do laboratório</Text>
          <Text style={s.muted}>Assistência inteligente para sua rotina.</Text>
          <Card title="✦ Assistente IA" text="Tire dúvidas técnicas, estude casos e organize informações laboratoriais." onPress={() => setScreen("IA")} />
          <Card title="▣ Leitor de pedidos" text="Envie uma imagem e organize os exames solicitados." onPress={pickOrder} />
          <Card title="◫ Biblioteca" text="Consulte exames, setores e informações pré-analíticas." onPress={() => setScreen("Exames")} />
          <View style={s.notice}>
            <Text style={s.noticeTitle}>Proteção de dados</Text>
            <Text style={s.noticeText}>Evite inserir dados identificáveis de pacientes durante testes e desenvolvimento.</Text>
          </View>
        </ScrollView>
      )}

      {screen === "IA" && (
        <View style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={s.chat}>
            {chat.map((m, i) => (
              <View key={i} style={[s.bubble, m.role === "user" ? s.user : s.assistant]}>
                <Text style={m.role === "user" ? s.userText : s.assistantText}>{m.content}</Text>
              </View>
            ))}
            {loading && <ActivityIndicator />}
          </ScrollView>
          <View style={s.composer}>
            <TextInput value={message} onChangeText={setMessage} placeholder="Pergunte à LabIA..." placeholderTextColor="#80909b" style={s.input} />
            <Pressable style={s.send} onPress={ask}>
              <Text style={s.sendTxt}>➤</Text>
            </Pressable>
          </View>
        </View>
      )}

      {screen === "Pedido" && (
        <ScrollView contentContainerStyle={s.body}>
          <Text style={s.h1}>Leitor de pedidos</Text>
          {image && <Image source={{ uri: image }} style={s.preview} />}
          <Card title="📷 Selecionar pedido" text="Use uma foto nítida, sem cortes e com boa iluminação." onPress={pickOrder} />
          {loading && <ActivityIndicator />}
        </ScrollView>
      )}

      {screen === "Exames" && (
        <ScrollView contentContainerStyle={s.body}>
          <Text style={s.h1}>Biblioteca</Text>
          <TextInput style={s.search} placeholder="Pesquisar exame..." placeholderTextColor="#80909b" />
          {["Hemograma", "Glicose", "Creatinina", "AST / TGO", "ALT / TGP", "TSH", "T4 livre", "Urina tipo 1", "Urocultura", "Coagulograma"].map((x) => (
            <Pressable
              key={x}
              style={s.exam}
              onPress={() => {
                setScreen("IA");
                setMessage(`Explique o exame ${x}, incluindo finalidade, amostra, preparo, interferentes e cuidados pré-analíticos.`);
              }}
            >
              <Text style={s.examText}>{x}</Text>
              <Text style={s.arrow}>›</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {screen === "Perfil" && (
        <ScrollView contentContainerStyle={s.body}>
          <Text style={s.h1}>Perfil</Text>
          <View style={s.profile}>
            <Text style={s.profileIcon}>◎</Text>
            <Text style={s.profileTitle}>LabIA Profissional</Text>
            <Text style={s.muted}>Versão 4.0</Text>
          </View>

          <View style={{ marginTop: 15 }}>
            <Pressable style={s.adminButton} onPress={generateInvite}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.adminButtonText}>🎟 Gerar Código de Convite</Text>}
            </Pressable>
            {generatedCode && (
              <View style={s.codeBox}>
                <Text style={s.codeBoxLabel}>Código Gerado:</Text>
                <Text style={s.codeBoxValue}>{generatedCode}</Text>
              </View>
            )}
          </View>

          <Pressable
            style={s.logout}
            onPress={async () => {
              await AsyncStorage.removeItem("labia_token");
              setToken(null);
            }}
          >
            <Text style={s.logoutText}>Sair da conta</Text>
          </Pressable>
        </ScrollView>
      )}

      <View style={s.nav}>
        {menu.map(([x, ico]) => (
          <Pressable key={x} onPress={() => setScreen(x)} style={s.navItem}>
            <Text style={[s.navIcon, screen === x && s.active]}>{ico}</Text>
            <Text style={[s.navLabel, screen === x && s.active]}>{x}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

function Login({
  email,
  setEmail,
  password,
  setPassword,
  name,
  setName,
  inviteCode,
  setInviteCode,
  login,
  register,
  isRegistering,
  setIsRegistering,
  loading
}: any) {
  return (
    <SafeAreaView style={s.login}>
      <StatusBar style="light" />
      <Text style={s.loginLogo}>LabIA</Text>
      <Text style={s.loginSub}>Análises Clínicas • V4 Profissional</Text>
      <View style={s.loginCard}>
        <Text style={s.loginTitle}>{isRegistering ? "Criar Conta" : "Entrar"}</Text>

        {isRegistering && (
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Nome Completo"
            placeholderTextColor="#80909b"
            style={s.loginInput}
          />
        )}

        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="E-mail"
          placeholderTextColor="#80909b"
          style={s.loginInput}
        />

        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Senha"
          placeholderTextColor="#80909b"
          style={s.loginInput}
        />

        {isRegistering && (
          <TextInput
            value={inviteCode}
            onChangeText={setInviteCode}
            autoCapitalize="characters"
            placeholder="Código de Convite (Ex: LAB-XXXXXX)"
            placeholderTextColor="#80909b"
            style={s.loginInput}
          />
        )}

        <Pressable style={s.loginButton} onPress={isRegistering ? register : login}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.loginButtonText}>{isRegistering ? "Cadastrar" : "Acessar LabIA"}</Text>
          )}
        </Pressable>

        <Pressable style={{ marginTop: 15 }} onPress={() => setIsRegistering(!isRegistering)}>
          <Text style={s.switchText}>
            {isRegistering ? "Já tem uma conta? Entrar" : "Possui um convite? Criar conta"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Card({ title, text, onPress }: any) {
  return (
    <Pressable style={s.card} onPress={onPress}>
      <Text style={s.cardTitle}>{title}</Text>
      <Text style={s.cardText}>{text}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f4f7f9" },
  header: { backgroundColor: "#062d4c", padding: 18, paddingTop: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  logo: { fontSize: 29, fontWeight: "900", color: "#fff" },
  sub: { fontSize: 12, color: "#a8d8bd" },
  online: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#5bd29b" },
  onlineText: { color: "#d8e9e1", fontSize: 11 },
  body: { padding: 18, paddingBottom: 100 },
  h1: { fontSize: 25, fontWeight: "900", color: "#082f4d", marginBottom: 5 },
  muted: { color: "#71808b", lineHeight: 19, marginBottom: 16 },
  card: { backgroundColor: "#fff", borderRadius: 18, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: "#e0e7eb" },
  cardTitle: { fontSize: 18, fontWeight: "900", color: "#0a3856" },
  cardText: { color: "#6d7c86", marginTop: 6, lineHeight: 20 },
  notice: { backgroundColor: "#e7f3ed", padding: 16, borderRadius: 16, marginTop: 5 },
  noticeTitle: { fontWeight: "900", color: "#145d3d" },
  noticeText: { color: "#456858", marginTop: 4, lineHeight: 19 },
  chat: { padding: 16, paddingBottom: 120, gap: 9 },
  bubble: { padding: 13, borderRadius: 16, maxWidth: "89%" },
  user: { backgroundColor: "#0b5b89", alignSelf: "flex-end" },
  assistant: { backgroundColor: "#fff", alignSelf: "flex-start", borderWidth: 1, borderColor: "#e0e7eb" },
  userText: { color: "#fff", lineHeight: 20 },
  assistantText: { color: "#1c303c", lineHeight: 20 },
  composer: { position: "absolute", bottom: 66, left: 10, right: 10, backgroundColor: "#fff", borderWidth: 1, borderColor: "#dbe4e8", borderRadius: 17, padding: 7, flexDirection: "row" },
  input: { flex: 1, padding: 10, color: "#16303d", maxHeight: 80 },
  send: { backgroundColor: "#0b5b89", width: 44, height: 44, borderRadius: 13, justifyContent: "center", alignItems: "center" },
  sendTxt: { color: "#fff", fontSize: 21 },
  preview: { height: 280, width: "100%", resizeMode: "contain", backgroundColor: "#e7edf0", borderRadius: 16, marginBottom: 12 },
  search: { backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#dce5e9", padding: 14, color: "#17313e", marginBottom: 10 },
  exam: { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 8, flexDirection: "row", justifyContent: "space-between", borderWidth: 1, borderColor: "#e2e9ed" },
  examText: { fontWeight: "800", color: "#123247" },
  arrow: { fontSize: 25, color: "#0b5b89" },
  profile: { backgroundColor: "#fff", padding: 25, borderRadius: 18, alignItems: "center", borderWidth: 1, borderColor: "#e0e7eb" },
  profileIcon: { fontSize: 55, color: "#0b5b89" },
  profileTitle: { fontSize: 19, fontWeight: "900", color: "#082f4d", marginTop: 5 },
  logout: { marginTop: 15, borderRadius: 14, borderWidth: 1, borderColor: "#d9aaaa", padding: 15 },
  logoutText: { textAlign: "center", color: "#9b3434", fontWeight: "900" },
  nav: { position: "absolute", bottom: 0, left: 0, right: 0, height: 66, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#e2e8eb", flexDirection: "row" },
  navItem: { width: "20%", alignItems: "center", justifyContent: "center" },
  navIcon: { fontSize: 20, color: "#8c9aa3" },
  navLabel: { fontSize: 10, color: "#8c9aa3", marginTop: 2 },
  active: { color: "#0b5b89", fontWeight: "900" },
  login: { flex: 1, backgroundColor: "#062d4c", justifyContent: "center", padding: 22 },
  loginLogo: { fontSize: 48, fontWeight: "900", color: "#fff", textAlign: "center" },
  loginSub: { color: "#b5dcca", textAlign: "center", marginBottom: 30 },
  loginCard: { backgroundColor: "#fff", borderRadius: 22, padding: 22 },
  loginTitle: { fontSize: 24, fontWeight: "900", color: "#082f4d", marginBottom: 15 },
  loginInput: { borderWidth: 1, borderColor: "#dce5e9", borderRadius: 13, padding: 14, marginBottom: 10, color: "#16303d" },
  loginButton: { backgroundColor: "#0b5b89", borderRadius: 14, padding: 15, alignItems: "center", marginTop: 4 },
  loginButtonText: { color: "#fff", fontWeight: "900" },
  switchText: { textAlign: "center", color: "#0b5b89", fontWeight: "700", marginTop: 5 },
  adminButton: { backgroundColor: "#145d3d", borderRadius: 14, padding: 15, alignItems: "center" },
  adminButtonText: { color: "#fff", fontWeight: "900" },
  codeBox: { backgroundColor: "#e7f3ed", padding: 12, borderRadius: 12, marginTop: 10, alignItems: "center" },
  codeBoxLabel: { fontSize: 12, color: "#145d3d", fontWeight: "600" },
  codeBoxValue: { fontSize: 18, color: "#145d3d", fontWeight: "900", marginTop: 2 }
});