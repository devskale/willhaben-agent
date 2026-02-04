import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { ListingDetail } from "../types.js";
import { createImagePlaceholder, createImageFrame } from "./ascii-art.js";

// ANSI escape code for clickable URL
function clickableUrl(url: string, label?: string): string {
  const text = label || url;
  // OSC 8 ; params ; URI ST
  return `\x1b]8;;${url}\x07${text}\x1b]8;;\x07`;
}

interface DetailViewProps {
  listing: ListingDetail | null;
  loading: boolean;
  onBack: () => void;
}

export function DetailView({ listing, loading, onBack }: DetailViewProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  if (loading) {
    return (
      <Box marginTop={1}>
        <Text color="yellow">Loading details...</Text>
      </Box>
    );
  }

  if (!listing) return null;

  const hasImages = listing.images && listing.images.length > 0;
  const currentImage = hasImages ? listing.images[selectedImageIndex] : null;
  const imageUrl = currentImage || listing.url;

  // Handle keyboard for image navigation
  useInput((input, key) => {
    if (!hasImages) return;

    if (key.leftArrow && selectedImageIndex > 0) {
      setSelectedImageIndex(selectedImageIndex - 1);
    }
    if (key.rightArrow && selectedImageIndex < listing.images.length - 1) {
      setSelectedImageIndex(selectedImageIndex + 1);
    }
  });

  // Parse attributes into an array
  const attributes = listing.attributes
    ? Object.entries(listing.attributes)
    : [];

  return (
    <Box
      flexDirection="column"
      marginTop={1}
      borderStyle="round"
      borderColor="white"
      padding={1}
    >
      {/* Product Header with Image Indicator */}
      <Box flexDirection="row" justifyContent="space-between">
        <Box width="80%">
          <Text bold color="green" inverse>
            {" " + listing.title.substring(0, 55) + (listing.title.length > 55 ? "..." : "") + " "}
          </Text>
        </Box>
        <Box width="20%">
          <Text color="cyan">
            {hasImages ? "📷 IMG" : "NO IMG"}
          </Text>
        </Box>
      </Box>

      <Text color="yellow" bold>
        {listing.priceText}
      </Text>
      <Text color="dim">ID: {listing.id}</Text>

      {/* Image Preview Section - ALWAYS SHOW */}
      <Box marginTop={1} flexDirection="column">
        <Text bold color="cyan">Image:</Text>
        <Box
          borderStyle="double"
          borderColor="cyan"
          paddingX={2}
          paddingY={1}
          marginTop={0}
        >
          {hasImages ? (
            <Box flexDirection="column">
              <Text color="cyan">
                {createImageFrame(true)}
              </Text>
              <Box marginTop={0}>
                <Text color="yellow">
                  [{selectedImageIndex + 1} / {listing.images.length}]
                </Text>
              </Box>
            </Box>
          ) : (
            <Box flexDirection="column">
              <Text color="gray">
                {createImageFrame(false) || "[ NO IMAGE AVAILABLE ]"}
              </Text>
            </Box>
          )}
        </Box>
      </Box>

      {/* Clickable URL Section - ALWAYS SHOW */}
      <Box marginTop={1} flexDirection="column">
        <Text bold color="blue">URL:</Text>
        <Box
          borderStyle="single"
          borderColor="blue"
          paddingX={1}
          marginTop={0}
        >
          <Text color="blue">
            {clickableUrl(imageUrl, "  " + imageUrl)}
          </Text>
        </Box>
        <Text color="dim" italic>
          (Ctrl+Click or copy URL to open in browser)
        </Text>
      </Box>

      {/* Image Navigation */}
      {hasImages && (
        <Box marginTop={0} flexDirection="row" justifyContent="center">
          <Text color="dim">
            {selectedImageIndex === 0 ? "  " : "← "}
          </Text>
          <Text color="yellow">
            Browse {selectedImageIndex + 1} of {listing.images.length}
          </Text>
          <Text color="dim">
            {selectedImageIndex === listing.images.length - 1 ? "  " : " →"}
          </Text>
        </Box>
      )}

      {/* Description */}
      <Box marginTop={1} flexDirection="column">
        <Text bold>Description:</Text>
        <Text>
          {listing.fullDescription || listing.description || "No description available"}
        </Text>
      </Box>

      {/* Product Details */}
      <Box marginTop={1} flexDirection="column">
        <Text bold>Details:</Text>
        <Text color="cyan">  📍 {listing.location}</Text>
        <Text color="cyan">  👤 {listing.sellerName}</Text>
        {listing.paylivery && (
          <Text color="magenta">  ✓ PayLivery Available</Text>
        )}
      </Box>

      {/* Attributes */}
      {attributes.length > 0 && (
        <Box marginTop={1} flexDirection="column">
          <Text bold>Attributes:</Text>
          {attributes.slice(0, 8).map(([key, val]) => (
            <Text key={key} color="dim">
              {"  • "}
              {key}:{" "}
              {Array.isArray(val) ? val.join(", ") : val}
            </Text>
          ))}
        </Box>
      )}

      {/* Quick Actions */}
      <Box marginTop={1}>
        <Text color="dim">Actions: </Text>
        <Text color="blue">URL</Text>
        <Text color="dim"> | </Text>
        <Text color="green">← Back</Text>
      </Box>

      {/* Navigation Hint */}
      <Box marginTop={0}>
        <Text color="dim" italic>
          ← →: Browse images | Esc: Back
        </Text>
      </Box>
    </Box>
  );
}
