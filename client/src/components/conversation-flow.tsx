import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bot, User, Send } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Conversation } from "@shared/schema";

interface ConversationFlowProps {
  sessionId: string;
}

export default function ConversationFlow({ sessionId }: ConversationFlowProps) {
  const [userResponse, setUserResponse] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(null);
  const [followUpIndex, setFollowUpIndex] = useState(0);
  const [needsCorrection, setNeedsCorrection] = useState(false);
  const [currentBaseQuestion, setCurrentBaseQuestion] = useState<string>("");
  const queryClient = useQueryClient();

  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/sessions", sessionId, "conversations"],
    enabled: !!sessionId,
  });

  const createConversationMutation = useMutation({
    mutationFn: async (data: { sessionId: string; type: string; content: string; timestamp: number }) => {
      const res = await apiRequest("POST", "/api/conversations", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions", sessionId, "conversations"] });
    },
  });

  const getAIQuestionMutation = useMutation({
    mutationFn: async (data: { 
      sessionId: string; 
      questionId?: string; 
      followUpIndex?: number;
      baseQuestion?: string;
      userResponse?: string;
    }) => {
      const res = await apiRequest("POST", "/api/ai/question", data);
      return res.json();
    },
    onSuccess: (data) => {
      setCurrentQuestionId(data.questionId);
      // Track base question for follow-ups
      if (!data.isFollowUp) {
        setCurrentBaseQuestion(data.question);
      }
      createConversationMutation.mutate({
        sessionId,
        type: "ai_question",
        content: data.question,
        timestamp: Math.floor(Date.now() / 1000),
      });
    },
  });

  const getAIFeedbackMutation = useMutation({
    mutationFn: async (data: { response: string; sessionId: string; questionId?: string }) => {
      const res = await apiRequest("POST", "/api/ai/feedback", data);
      return res.json();
    },
  });

  useEffect(() => {
    // Start with an initial AI question
    if (conversations.length === 0) {
      getAIQuestionMutation.mutate({ sessionId });
    }
  }, [sessionId, conversations.length]);

  const handleSubmitResponse = async () => {
    if (!userResponse.trim()) return;

    setIsTyping(true);
    
    // Add user response
    await createConversationMutation.mutateAsync({
      sessionId,
      type: "user_response",
      content: userResponse,
      timestamp: Math.floor(Date.now() / 1000),
    });

    // Get AI feedback with enhanced analysis
    const feedback = await getAIFeedbackMutation.mutateAsync({ 
      response: userResponse, 
      sessionId,
      questionId: currentQuestionId || undefined
    });
    
    // Add AI feedback
    await createConversationMutation.mutateAsync({
      sessionId,
      type: "ai_feedback",
      content: JSON.stringify(feedback),
      timestamp: Math.floor(Date.now() / 1000),
    });

    setNeedsCorrection(feedback.needsCorrection);

    // Determine next action based on feedback
    if (feedback.needsCorrection) {
      // If correction needed, ask for clarification/improvement
      setTimeout(async () => {
        await createConversationMutation.mutateAsync({
          sessionId,
          type: "ai_question",
          content: feedback.correctionMessage,
          timestamp: Math.floor(Date.now() / 1000),
        });
        setIsTyping(false);
      }, 1500);
    } else if (currentQuestionId && followUpIndex < 2) {
      // Ask contextual follow-up question based on user's response
      setTimeout(async () => {
        await getAIQuestionMutation.mutateAsync({ 
          sessionId, 
          questionId: currentQuestionId, 
          followUpIndex,
          baseQuestion: currentBaseQuestion,
          userResponse: userResponse
        });
        setFollowUpIndex(prev => prev + 1);
        setIsTyping(false);
      }, 2000);
    } else {
      // Move to next primary question
      setTimeout(async () => {
        await getAIQuestionMutation.mutateAsync({ sessionId });
        setFollowUpIndex(0);
        setIsTyping(false);
      }, 2000);
    }

    setUserResponse("");
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000 / 60);
    
    if (diff < 1) return "Just now";
    if (diff < 60) return `${diff} min ago`;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-lg font-semibold text-neutral-800 mb-4">AI Conversation Flow</h3>
      
      <div className="space-y-4 max-h-96 overflow-y-auto mb-4">
        {conversations.map((conversation) => (
          <div
            key={conversation.id}
            className={`flex items-start space-x-3 ${
              conversation.type === "user_response" ? "justify-end" : ""
            }`}
          >
            {conversation.type !== "user_response" && (
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                <Bot className="text-white" size={16} />
              </div>
            )}
            
            <div className={`flex-1 ${conversation.type === "user_response" ? "max-w-md" : ""}`}>
              <div
                className={`rounded-lg p-3 ${
                  conversation.type === "user_response"
                    ? "bg-primary text-white"
                    : "bg-neutral-100"
                }`}
              >
                {conversation.type === "ai_feedback" ? (
                  <div>
                    {JSON.parse(conversation.content).feedbacks?.map((feedback: any, idx: number) => (
                      <div key={idx} className="text-sm mb-1">
                        <span className={`mr-2 ${
                          feedback.type === "positive" ? "text-green-600" : 
                          feedback.type === "warning" ? "text-amber-600" : "text-blue-600"
                        }`}>
                          {feedback.type === "positive" ? "✓" : 
                           feedback.type === "warning" ? "⚠" : "ℹ"}
                        </span>
                        {feedback.message}
                      </div>
                    ))}
                    {JSON.parse(conversation.content).needsCorrection && (
                      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                        🔄 {JSON.parse(conversation.content).correctionMessage}
                      </div>
                    )}
                    {JSON.parse(conversation.content).suggestion && !JSON.parse(conversation.content).needsCorrection && (
                      <div className="mt-2 p-2 bg-blue-50 rounded text-sm text-blue-800">
                        💡 {JSON.parse(conversation.content).suggestion}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm">{conversation.content}</p>
                )}
              </div>
              <div
                className={`text-xs text-neutral-500 mt-1 ${
                  conversation.type === "user_response" ? "text-right" : ""
                }`}
              >
                {conversation.type === "user_response" ? "You" : "AI"} • {formatTimestamp(conversation.timestamp)}
              </div>
            </div>

            {conversation.type === "user_response" && (
              <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center flex-shrink-0">
                <User className="text-white" size={16} />
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-neutral-300 rounded-full flex items-center justify-center flex-shrink-0">
              <Bot className="text-neutral-600" size={16} />
            </div>
            <div className="bg-neutral-100 rounded-lg p-3">
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Response input */}
      <div className="flex space-x-2">
        <Textarea
          value={userResponse}
          onChange={(e) => setUserResponse(e.target.value)}
          placeholder="Type your response..."
          className="flex-1"
          rows={2}
        />
        <Button
          onClick={handleSubmitResponse}
          disabled={!userResponse.trim() || createConversationMutation.isPending}
          className="bg-primary hover:bg-primary/90"
        >
          <Send size={16} />
        </Button>
      </div>
    </div>
  );
}
