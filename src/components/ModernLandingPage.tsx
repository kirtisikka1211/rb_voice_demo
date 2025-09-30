import React from 'react';
import { Users, Building2, Mic, FileText, Shield, Zap } from 'lucide-react';

// Lightweight local Button and Card components to avoid external deps
const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = '', children, ...props }) => (
  <button
    {...props}
    className={`inline-flex items-center justify-center rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors ${className}`}
  >
    {children}
  </button>
);

const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', children, ...props }) => (
  <div {...props} className={`bg-card text-card-foreground border border-[hsl(var(--card-border))] rounded-xl ${className}`}>
    {children}
  </div>
);

const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', children, ...props }) => (
  <div {...props} className={`p-6 ${className}`}>{children}</div>
);

const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className = '', children, ...props }) => (
  <h3 {...props} className={`text-xl font-semibold ${className}`}>{children}</h3>
);

const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ className = '', children, ...props }) => (
  <p {...props} className={`text-muted-foreground ${className}`}>{children}</p>
);

const ModernLandingPage: React.FC = () => {
  const handleLogin = () => {
    window.location.href = '/api/login';
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-primary/10 via-background to-accent/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6">
              Modern Interview
              <span className="text-primary block">Platform</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
              Streamline your hiring process with AI-powered voice interviews, real-time transcription,
              and comprehensive candidate evaluation tools.
            </p>
            <Button
              onClick={handleLogin}
              data-testid="button-get-started"
              className="text-lg px-8 py-3"
            >
              Get Started
            </Button>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-4">Everything You Need for Modern Hiring</h2>
          <p className="text-lg text-muted-foreground">Powerful tools for both candidates and recruiters</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="hover-elevate">
            <CardHeader>
              <Mic className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Voice Interviews</CardTitle>
              <CardDescription>
                Conduct natural voice conversations with real-time transcription and analysis
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover-elevate">
            <CardHeader>
              <FileText className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Smart Resume Processing</CardTitle>
              <CardDescription>
                Upload and analyze resumes with intelligent matching against job requirements
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover-elevate">
            <CardHeader>
              <Shield className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Secure & Compliant</CardTitle>
              <CardDescription>
                Enterprise-grade security with GDPR compliance and data protection
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover-elevate">
            <CardHeader>
              <Users className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Candidate Experience</CardTitle>
              <CardDescription>
                Intuitive interface for candidates to showcase their skills and experience
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover-elevate">
            <CardHeader>
              <Building2 className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Recruiter Dashboard</CardTitle>
              <CardDescription>
                Comprehensive tools for managing job descriptions, questions, and evaluations
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover-elevate">
            <CardHeader>
              <Zap className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Real-time Analytics</CardTitle>
              <CardDescription>
                Instant insights and performance metrics to improve your hiring process
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-primary/5 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">Ready to Transform Your Hiring?</h2>
          <p className="text-lg text-muted-foreground mb-8">Join thousands of companies already using our platform</p>
          <Button
            onClick={handleLogin}
            data-testid="button-start-now"
            className="text-lg px-8 py-3"
          >
            Start Now
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ModernLandingPage;


