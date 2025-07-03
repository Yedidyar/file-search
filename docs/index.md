---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: 'File Search System'
  text: 'Documentation'
  tagline: Comprehensive file scanning and search system with distributed agents, web interface, and intelligent tagging
  actions:
    - theme: brand
      text: Get Started
      link: /quick-start
    - theme: alt
      text: System Architecture Overview
      link: /README

features:
  - title: 🔍 Smart Search & Discovery
    details: Advanced search capabilities powered by Typesense with fuzzy matching, tag-based filtering, and real-time indexing for fast file discovery
  - title: 🌐 Web-Based Interface
    details: Modern React frontend with intuitive search filters, tag editing capabilities, and file upload functionality for seamless user experience
  - title: 🚀 Distributed File Scanning
    details: Go-based scanning agents deployed across multiple servers for efficient file system monitoring and metadata extraction
  - title: 📊 Centralized Management
    details: NestJS backend with PostgreSQL database providing unified file metadata management, agent coordination, and API services
  - title: 🔒 Secure & Scalable
    details: API key authentication, role-based access control, and microservices architecture designed for enterprise-scale deployments
  - title: 📈 Intelligent Tagging
    details: Rule-based automatic tagging system using directory structure and naming conventions, with manual tag editing capabilities
---
