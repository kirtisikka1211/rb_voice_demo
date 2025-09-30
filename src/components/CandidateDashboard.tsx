import React, { useState } from 'react';
import { CalendarDays, FileText, Linkedin, Play, CheckCircle, Clock } from 'lucide-react';
import FileUpload from './FileUpload';

const Badge: React.FC<{ variant?: 'default' | 'secondary' | 'outline'; className?: string } & React.HTMLAttributes<HTMLSpanElement>> = ({ variant = 'outline', className = '', children, ...props }) => {
  const base = 'inline-flex items-center rounded-full px-2 py-0.5 text-xs border';
  const variants: Record<string, string> = {
    default: 'bg-blue-600 text-white border-transparent',
    secondary: 'bg-gray-100 text-gray-800 border-transparent',
    outline: 'bg-transparent text-gray-800 border-gray-300',
  };
  return (
    <span {...props} className={`${base} ${variants[variant]} ${className}`}>{children}</span>
  );
};

const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'solid' | 'outline'; size?: 'sm' | 'md' } > = ({ variant = 'solid', size = 'md', className = '', children, ...props }) => {
  const base = 'inline-flex items-center justify-center rounded-md transition-colors';
  const variants = variant === 'solid' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'border border-gray-300 text-gray-800 hover:bg-gray-50';
  const sizes = size === 'sm' ? 'text-sm px-3 py-2' : 'text-base px-4 py-2.5';
  return (
    <button {...props} className={`${base} ${variants} ${sizes} ${className}`}>{children}</button>
  );
};

const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', children, ...props }) => (
  <div {...props} className={`bg-white border border-gray-200 rounded-xl ${className}`}>{children}</div>
);
const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', children, ...props }) => (
  <div {...props} className={`p-6 ${className}`}>{children}</div>
);
const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className = '', children, ...props }) => (
  <h3 {...props} className={`text-lg font-medium ${className}`}>{children}</h3>
);
const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ className = '', children, ...props }) => (
  <p {...props} className={`text-sm text-gray-600 ${className}`}>{children}</p>
);
const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', children, ...props }) => (
  <div {...props} className={`p-6 ${className}`}>{children}</div>
);

const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className = '', ...props }) => (
  <input {...props} className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`} />
);
const Label: React.FC<React.LabelHTMLAttributes<HTMLLabelElement>> = ({ className = '', ...props }) => (
  <label {...props} className={`text-sm text-gray-700 ${className}`} />
);
const Textarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({ className = '', ...props }) => (
  <textarea {...props} className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`} />
);

export default function CandidateDashboard() {
  const [linkedinProfile, setLinkedinProfile] = useState('');
  const [coverLetter, setCoverLetter] = useState('');
  const [resumeUploaded, setResumeUploaded] = useState(false);

  const mockInterviews = [
    { id: 1, title: 'Senior Frontend Developer', company: 'TechCorp Inc.', date: '2024-01-15', status: 'scheduled' as const, time: '2:00 PM' },
    { id: 2, title: 'Full Stack Engineer', company: 'StartupXYZ', date: '2024-01-12', status: 'completed' as const, time: '10:00 AM' },
    { id: 3, title: 'React Developer', company: 'DevStudio', date: '2024-01-10', status: 'available' as const, time: 'Available' },
  ];

  const completionPercentage = () => {
    let completed = 0;
    if (resumeUploaded) completed += 40;
    if (linkedinProfile) completed += 30;
    if (coverLetter) completed += 30;
    return completed;
  };

  const handleStartInterview = (interviewId: number) => {
    console.log('Starting interview:', interviewId);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <Badge variant="default" className="gap-1"><Clock className="w-3 h-3" />Scheduled</Badge>;
      case 'completed':
        return <Badge variant="secondary" className="gap-1"><CheckCircle className="w-3 h-3" />Completed</Badge>;
      case 'available':
        return <Badge variant="outline" className="gap-1"><Play className="w-3 h-3" />Available</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Candidate Dashboard</h1>
        <p className="text-muted-foreground">Manage your profile and access interviews</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Profile Completion
              </CardTitle>
              <CardDescription>Complete your profile to access more interview opportunities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Progress</span>
                <span className="text-sm text-muted-foreground">{completionPercentage()}%</span>
              </div>
              <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600" style={{ width: `${completionPercentage()}%` }} />
              </div>
            </CardContent>
          </Card> */}

          <Card>
            <CardHeader>
              <CardTitle>Resume Upload</CardTitle>
              <CardDescription>Upload your latest resume in PDF or Word format</CardDescription>
            </CardHeader>
            <CardContent>
              <FileUpload
                label="Upload Resume"
                description="Drag and drop your resume here or click to browse"
                accept=".pdf,.doc,.docx"
                onFilesSelected={(files) => { console.log('Resume uploaded:', files); setResumeUploaded(true); }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Linkedin className="h-5 w-5 text-blue-600" />
                LinkedIn Profile
              </CardTitle>
              <CardDescription>Add your LinkedIn profile URL to enhance your application</CardDescription>
            </CardHeader>
            <CardContent>
              <div>
                <Label htmlFor="linkedin">LinkedIn Profile URL</Label>
                <Input id="linkedin" placeholder="https://linkedin.com/in/your-profile" value={linkedinProfile} onChange={(e) => setLinkedinProfile(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          {/* <Card>
            <CardHeader>
              <CardTitle>Cover Letter</CardTitle>
              <CardDescription>Write a brief cover letter to introduce yourself</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea placeholder="Tell us about yourself and why you're interested in this role..." value={coverLetter} onChange={(e) => setCoverLetter(e.target.value)} className="min-h-32" />
            </CardContent>
          </Card> */}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                Interview Opportunities
              </CardTitle>
              <CardDescription>Your scheduled and available interviews</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {mockInterviews.map((interview) => (
                <Card key={interview.id} className="p-4">
                  <div className="space-y-3">
                    <div>
                      <h3 className="font-medium text-foreground" data-testid={`interview-title-${interview.id}`}>{interview.title}</h3>
                      <p className="text-sm text-muted-foreground">{interview.company}</p>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="text-xs text-muted-foreground">{interview.date} • {interview.time}</div>
                      {getStatusBadge(interview.status)}
                    </div>
                    {interview.status === 'available' && (
                      <Button size="sm" className="w-full gap-2" onClick={() => handleStartInterview(interview.id)} data-testid={`button-start-interview-${interview.id}`}>
                        <Play className="w-4 h-4" />
                        Start Interview
                      </Button>
                    )}
                    {interview.status === 'scheduled' && (
                      <Button size="sm" variant="outline" className="w-full gap-2" onClick={() => handleStartInterview(interview.id)} data-testid={`button-join-interview-${interview.id}`}>
                        <CalendarDays className="w-4 h-4" />
                        Join Interview
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}



