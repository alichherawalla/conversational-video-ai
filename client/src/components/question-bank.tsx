import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import {
  Plus,
  Briefcase,
  Users,
  Lightbulb,
  ChevronRight,
  Edit,
  Trash2,
  Save,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Question, InsertQuestion } from "@shared/schema";

export default function QuestionBank() {
  const [newQuestion, setNewQuestion] = useState<InsertQuestion>({
    primary: "",
    followUp1: "",
    followUp2: "",
    category: "Business & Entrepreneurship",
    difficulty: "medium",
  });

  const queryClient = useQueryClient();

  const { data: questions = [] } = useQuery<Question[]>({
    queryKey: ["/api/questions"],
  });

  const createQuestionMutation = useMutation({
    mutationFn: async (data: InsertQuestion) => {
      const res = await apiRequest("POST", "/api/questions", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/questions"] });
      setNewQuestion({
        primary: "",
        followUp1: "",
        followUp2: "",
        category: "Business & Entrepreneurship",
        difficulty: "medium",
      });
    },
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/questions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/questions"] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newQuestion.primary.trim()) {
      createQuestionMutation.mutate(newQuestion);
    }
  };

  const categories = [
    {
      name: "Business & Entrepreneurship",
      icon: Briefcase,
      color: "blue",
      count: questions.filter(
        (q) => q.category === "Business & Entrepreneurship",
      ).length,
    },
    {
      name: "Personal Development",
      icon: Users,
      color: "green",
      count: questions.filter((q) => q.category === "Personal Development")
        .length,
    },
    {
      name: "Innovation & Technology",
      icon: Lightbulb,
      color: "purple",
      count: questions.filter((q) => q.category === "Innovation & Technology")
        .length,
    },
  ];

  const recentQuestions = questions.slice(0, 5);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Question Categories */}

      {/* Question Manager */}
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-neutral-800 mb-4">
              Create New Question
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="primary">Primary Question</Label>
                <Textarea
                  id="primary"
                  value={newQuestion.primary}
                  onChange={(e) =>
                    setNewQuestion({ ...newQuestion, primary: e.target.value })
                  }
                  placeholder="What inspired you to start your entrepreneurial journey?"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={newQuestion.category}
                    onValueChange={(value) =>
                      setNewQuestion({ ...newQuestion, category: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Business & Entrepreneurship">
                        Business & Entrepreneurship
                      </SelectItem>
                      <SelectItem value="Personal Development">
                        Personal Development
                      </SelectItem>
                      <SelectItem value="Innovation & Technology">
                        Innovation & Technology
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="difficulty">Difficulty</Label>
                  <Select
                    value={newQuestion.difficulty}
                    onValueChange={(value) =>
                      setNewQuestion({ ...newQuestion, difficulty: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-primary text-white hover:bg-primary/90"
                disabled={createQuestionMutation.isPending}
              >
                <Save className="mr-2" size={16} />
                Save Question
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Recent Questions */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-neutral-800 mb-4">
              Recent Questions
            </h3>

            <div className="space-y-3">
              {recentQuestions.map((question) => (
                <div
                  key={question.id}
                  className="border border-neutral-200 rounded-lg p-3 hover:border-primary transition-colors cursor-pointer"
                >
                  <p className="text-sm text-neutral-800 mb-2">
                    {question.primary}
                  </p>
                  <div className="flex items-center justify-between text-xs text-neutral-500">
                    <span>{question.category}</span>
                    <div className="flex items-center space-x-2">
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                        <Edit className="text-primary" size={12} />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={() =>
                          deleteQuestionMutation.mutate(question.id)
                        }
                        disabled={deleteQuestionMutation.isPending}
                      >
                        <Trash2 className="text-red-500" size={12} />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
