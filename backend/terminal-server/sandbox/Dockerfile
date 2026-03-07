# Terminal Sandbox Container
# Minimal Alpine-based container for secure terminal sessions
#
# Security features:
# - Non-root user
# - Minimal packages (no network tools)
# - Read-only filesystem (with /tmp writable)
# - No capabilities
#
# Build: docker build -t blog-terminal-sandbox ./sandbox
# Test:  docker run -it --rm blog-terminal-sandbox

FROM alpine:3.19

# Install minimal utilities
RUN apk add --no-cache \
    bash \
    coreutils \
    less \
    nano \
    tree \
    ncurses \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN adduser -D -s /bin/sh -h /home/sandbox sandbox

# Create workspace directory
RUN mkdir -p /workspace && chown sandbox:sandbox /workspace

# Set up minimal bashrc
RUN echo 'export PS1="\[\e[32m\]sandbox\[\e[0m\]@\[\e[34m\]docker\[\e[0m\]:\[\e[33m\]\w\[\e[0m\]\$ "' > /home/sandbox/.bashrc \
    && echo 'alias ll="ls -la"' >> /home/sandbox/.bashrc \
    && echo 'alias la="ls -A"' >> /home/sandbox/.bashrc \
    && echo 'cd /workspace' >> /home/sandbox/.bashrc \
    && chown sandbox:sandbox /home/sandbox/.bashrc

# Create welcome message
RUN echo '#!/bin/sh' > /etc/profile.d/welcome.sh \
    && echo 'echo ""' >> /etc/profile.d/welcome.sh \
    && echo 'echo "  ╔══════════════════════════════════════╗"' >> /etc/profile.d/welcome.sh \
    && echo 'echo "  ║   🐳 Blog Terminal Sandbox           ║"' >> /etc/profile.d/welcome.sh \
    && echo 'echo "  ║   Isolated Docker Environment        ║"' >> /etc/profile.d/welcome.sh \
    && echo 'echo "  ╚══════════════════════════════════════╝"' >> /etc/profile.d/welcome.sh \
    && echo 'echo ""' >> /etc/profile.d/welcome.sh \
    && echo 'echo "  Available commands: ls, cat, less, nano, tree"' >> /etc/profile.d/welcome.sh \
    && echo 'echo "  Network: DISABLED | Timeout: 10 minutes"' >> /etc/profile.d/welcome.sh \
    && echo 'echo ""' >> /etc/profile.d/welcome.sh \
    && chmod +x /etc/profile.d/welcome.sh

# Add sample files
RUN mkdir -p /workspace/examples \
    && echo '# Hello from the Sandbox!\n\nThis is a secure, isolated terminal environment.\n\n## Features\n- No network access\n- Limited resources\n- Automatic cleanup' > /workspace/examples/README.md \
    && echo '#!/bin/sh\necho "Hello, World!"' > /workspace/examples/hello.sh \
    && chmod +x /workspace/examples/hello.sh \
    && chown -R sandbox:sandbox /workspace

# Switch to non-root user
USER sandbox
WORKDIR /workspace

# Default shell
CMD ["/bin/sh", "-l"]
