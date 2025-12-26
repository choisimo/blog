import { useState, useEffect } from 'react';
import { ConfigManager } from '@/components/features/admin/ConfigManager';
import { WorkersManager } from '@/components/features/admin/WorkersManager';
import { AIManager } from '@/components/features/admin/ai';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Lock, Settings, Cloud, Bot } from 'lucide-react';

export default function AdminConfig() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('adminToken');
    if (storedToken) {
      verifyToken(storedToken);
    } else {
      setLoading(false);
    }
  }, []);

  const verifyToken = async (tokenToVerify: string) => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || ''}/api/v1/admin/config/categories`,
        {
          headers: { Authorization: `Bearer ${tokenToVerify}` },
        }
      );
      if (res.ok) {
        localStorage.setItem('adminToken', tokenToVerify);
        setIsAuthenticated(true);
      } else {
        localStorage.removeItem('adminToken');
        setError('Invalid or expired token');
      }
    } catch {
      setError('Failed to verify token');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    await verifyToken(token);
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    setIsAuthenticated(false);
    setToken('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Admin Authentication</CardTitle>
            <CardDescription>Enter your admin bearer token to access configuration</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="token">Bearer Token</Label>
                <Input
                  id="token"
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Enter your admin token"
                  autoFocus
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={!token}>
                Authenticate
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">환경변수, Workers, AI 모델 관리</p>
        </div>
        <Button variant="outline" onClick={handleLogout}>
          Logout
        </Button>
      </div>

      <Tabs defaultValue="config" className="space-y-6">
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="config" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            환경변수
          </TabsTrigger>
          <TabsTrigger value="workers" className="flex items-center gap-2">
            <Cloud className="h-4 w-4" />
            Workers
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            AI Models
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config">
          <ConfigManager />
        </TabsContent>

        <TabsContent value="workers">
          <WorkersManager />
        </TabsContent>

        <TabsContent value="ai">
          <AIManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
