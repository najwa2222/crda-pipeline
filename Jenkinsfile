pipeline {
    agent any

    environment {
        KUBECONFIG = credentials('kubeconfig')
        REPO_URL = 'https://github.com/najwa2222/crda-pipeline.git'
        KUBE_DIR = "kubernetes"  // Windows path to Kubernetes manifests
    }

    stages {
        stage('Checkout') {
            steps {
                checkout([
                    $class: 'GitSCM',
                    branches: [[name: '*/main']],
                    extensions: [],
                    userRemoteConfigs: [[
                        url: env.REPO_URL,
                        credentialsId: 'github-creds'
                    ]]
                ])
            }
        }

        stage('Build Docker Image') {
            steps {
                script {
                    dockerImage = docker.build("najwa22/crda-app:${env.BUILD_ID}")
                }
            }
        }

        stage('Push Docker Image') {
            steps {
                script {
                    docker.withRegistry(
                        'https://registry.hub.docker.com',
                        'dockerhub-credentials'  // Use credentials ID directly
                    ) {
                        dockerImage.push()
                        dockerImage.push('latest')
                    }
                }
            }
        }

        stage('Deploy to Kubernetes') {
            steps {
                bat """
                        kubectl apply -f %KUBE_DIR%/mysql-secret.yaml
                        kubectl apply -f %KUBE_DIR%/mysql-pv.yaml
                        kubectl apply -f %KUBE_DIR%/mysql-configmap.yaml
                        kubectl apply -f %KUBE_DIR%/mysql-deployment.yaml

                        # Fixed PowerShell command
                        powershell \"(Get-Content %KUBE_DIR%/app-deployment.yaml) -replace '\\`${BUILD_ID}', '${env.BUILD_ID}' | Set-Content %KUBE_DIR%/app-deployment.yaml\"
                        kubectl apply -f %KUBE_DIR%/app-deployment.yaml

                        kubectl get pods
                        kubectl get services
                    """
            }
}
    }

    post {
        success {
            echo 'Deployment successful!'
        }
        failure {
            echo 'Deployment failed!'
        }
    }
}
