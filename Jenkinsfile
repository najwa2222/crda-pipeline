pipeline {
    agent any

    environment {
        DOCKER_IMAGE = 'najwa22/crda-app'
        KUBE_DIR = 'kubernetes'
        DOCKER_HOST = 'tcp://localhost:2375'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout([$class: 'GitSCM', 
                  branches: [[name: '*/main']],
                  extensions: [], 
                  userRemoteConfigs: [[url: 'https://github.com/najwa2222/crda-pipeline.git']]
                ])
            }
        }

        stage('Build Docker Image') {
            steps {
                script {
                    // Use PowerShell for better error handling
                    powershell """
                        $ErrorActionPreference = 'Stop'
                        docker build -t ${env.DOCKER_IMAGE}:${env.BUILD_NUMBER} .
                        docker tag ${env.DOCKER_IMAGE}:${env.BUILD_NUMBER} ${env.DOCKER_IMAGE}:latest
                    """
                }
            }
        }

        stage('Deploy to Kubernetes') {
            steps {
                bat """
                    kubectl config use-context docker-desktop
                    kubectl apply -f ${KUBE_DIR}/mysql-secret.yaml
                    kubectl apply -f ${KUBE_DIR}/mysql-pv.yaml
                    kubectl apply -f ${KUBE_DIR}/mysql-configmap.yaml
                    kubectl apply -f ${KUBE_DIR}/mysql-deployment.yaml
                    kubectl set image deployment/app-deployment crda-app=${DOCKER_IMAGE}:%BUILD_NUMBER%
                """
            }
        }
    }

    post {
        always {
            bat "docker rmi ${DOCKER_IMAGE}:%BUILD_NUMBER%"
        }
    }
}