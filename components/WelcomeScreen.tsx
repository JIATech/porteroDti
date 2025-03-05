import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

type WelcomeScreenProps = {
  title?: string;
};

export default function WelcomeScreen({ title = 'Portero DTI' }: WelcomeScreenProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
});
