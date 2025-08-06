"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  Sparkles,
  Zap,
  LogIn,
  Brain,
  Users,
  Globe,
  Microscope,
  Palette,
  Database,
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AnimatedGroup } from "@/components/ui/animated-group";
import { signIn } from "next-auth/react";

const transitionVariants = {
  item: {
    hidden: {
      opacity: 0,
      y: 20,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring" as const,
        bounce: 0.25,
        duration: 0.8,
      },
    },
  },
};

const majorFeatures = [
  {
    icon: Microscope,
    title: "DeepResearch",
    description: "AI-powered research with multi-agent collaboration",
    color: "text-blue-600",
  },
  {
    icon: Palette,
    title: "AI-Frames",
    description: "Interactive learning with video and document integration",
    color: "text-indigo-600",
  },
  {
    icon: Database,
    title: "Knowledge Base",
    description: "Local RAG system with semantic search",
    color: "text-green-600",
  },
  {
    icon: Bot,
    title: "Multi-Agent AI",
    description: "Unified AI ecosystem with local and cloud options",
    color: "text-purple-600",
  },
];

export function HeroSection() {
  return (
    <>
      <main className="relative bg-white dark:bg-gray-900 min-h-screen">
        {/* Clean Background */}
        <div className="absolute inset-0 bg-gray-50 dark:bg-gray-900" />

        <section className="relative pt-24 pb-16 md:pt-32 md:pb-24 lg:pt-40 lg:pb-32">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-6xl mx-auto">
              {/* Challenge Badge */}
              <AnimatedGroup variants={transitionVariants} className="mb-8">
                <Link
                  href="https://www.kaggle.com/competitions/google-gemma-3n-hackathon"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full px-6 py-3 shadow-sm hover:shadow-md transition-all duration-300 group"
                >
                  <Badge
                    variant="secondary"
                    className="bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                  >
                    <Sparkles className="w-3 h-3 mr-1" />
                    Participating
                  </Badge>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Google Gemma 3n Impact Challenge
                  </span>
                  <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                </Link>
              </AnimatedGroup>

              {/* Main Heading */}
              <AnimatedGroup variants={transitionVariants} className="mb-8">
                <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 dark:text-white leading-tight mb-6">
                  TimeCapsule-SLM
                </h1>

                <div className="mb-6">
                  <h2 className="text-2xl md:text-3xl lg:text-4xl font-semibold text-gray-700 dark:text-gray-300 mb-4">
                    Solving Open Learning
                  </h2>
                  <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-400">
                    Complete AI-Powered Platform for Research, Creativity, and
                    Collaboration
                  </p>
                </div>

                <p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto leading-relaxed">
                  Advanced research tools with DeepResearch, in-browser RAG, and
                  collaborative TimeCapsule sharing for seamless knowledge
                  discovery.
                </p>
              </AnimatedGroup>

              {/* CTA Buttons */}
              <AnimatedGroup
                variants={{
                  ...transitionVariants,
                  item: {
                    ...transitionVariants.item,
                    visible: {
                      ...transitionVariants.item.visible,
                      transition: {
                        ...transitionVariants.item.visible.transition,
                        delay: 0.2,
                      },
                    },
                  },
                }}
                className="mb-16"
              >
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                  <Button
                    asChild
                    size="lg"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8"
                  >
                    <Link href="/deep-research">
                      <Zap className="w-5 h-5 mr-2" />
                      Start Research
                    </Link>
                  </Button>

                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="px-8 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <Link href="/ai-frames">
                      <span>Try AI-Frames</span>
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Link>
                  </Button>

                  <Button
                    onClick={() => signIn()}
                    size="lg"
                    variant="ghost"
                    className="px-8 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    <LogIn className="w-5 h-5 mr-2" />
                    Sign In
                  </Button>
                </div>
              </AnimatedGroup>

              {/* Features Grid */}
              <AnimatedGroup
                variants={{
                  ...transitionVariants,
                  item: {
                    ...transitionVariants.item,
                    visible: {
                      ...transitionVariants.item.visible,
                      transition: {
                        ...transitionVariants.item.visible.transition,
                        delay: 0.4,
                      },
                    },
                  },
                }}
                className="mb-16"
              >
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8">
                  <div className="text-center mb-8">
                    <Badge variant="outline" className="mb-4">
                      <Sparkles className="w-4 h-4 mr-1" />
                      Platform Features
                    </Badge>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                      Everything You Need for AI Research
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {majorFeatures.map((feature, index) => (
                      <div
                        key={index}
                        className="text-center p-6 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors duration-200"
                      >
                        <div
                          className={`inline-flex items-center justify-center w-12 h-12 rounded-lg bg-white dark:bg-gray-800 mb-4 ${feature.color}`}
                        >
                          <feature.icon className="w-6 h-6" />
                        </div>
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                          {feature.title}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                          {feature.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </AnimatedGroup>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
