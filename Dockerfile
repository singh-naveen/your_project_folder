# Base image: PHP-FPM (FastCGI Process Manager)
FROM php:8.1-fpm

# Install system dependencies and PHP extensions
RUN apt-get update && apt-get install -y \
    nginx \
    libmagickwand-dev \
    ghostscript \
    pkg-config \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Install ImageMagick PHP extension (Imagick)
RUN pecl install imagick \
    && docker-php-ext-enable imagick \
    && rm -rf /tmp/pear

# Copy Nginx configuration
COPY nginx.conf /etc/nginx/sites-available/default

# Copy the start script
COPY start.sh /usr/local/bin/start.sh

# Make the start script executable
RUN chmod +x /usr/local/bin/start.sh

# Copy your application code to the Nginx web root
COPY . /var/www/html/

# Set appropriate permissions for the uploads directory
RUN chmod -R 777 /var/www/html/temp_uploads

# Expose port 80 for Nginx (web traffic)
EXPOSE 80

# Command to run when the container starts
CMD ["/usr/local/bin/start.sh"]
