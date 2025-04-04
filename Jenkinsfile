pipeline {
    agent any

    environment {
        DOCKER_IMAGE = "najwa22/crda-app"
        DOCKER_TAG = "${env.BUILD_NUMBER}"
        KUBE_NAMESPACE = "crda-namespace"
        MYSQL_SECRET = "mysql-secret"
        KUBECONFIG = "C:\\Users\\your-username\\.kube\\config"  // Update with your Windows path
    }

    stages {
        stage('Checkout SCM') {
            steps {
                git url: 'https://github.com/najwa2222/crda-pipeline.git', branch: 'main'
            }
        }

        stage('Build Docker Image') {
            steps {
                bat """
                    docker build -t %DOCKER_IMAGE%:%DOCKER_TAG% .
                    docker tag %DOCKER_IMAGE%:%DOCKER_TAG% %DOCKER_IMAGE%:latest
                """
            }
        }

        stage('Push to Docker Hub') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'dockerhub-creds',
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS'
                )]) {
                    bat """
                        docker login -u %DOCKER_USER% -p %DOCKER_PASS%
                        docker push %DOCKER_IMAGE%:%DOCKER_TAG%
                        docker push %DOCKER_IMAGE%:latest
                    """
                }
            }
        }

        stage('Deploy to Kubernetes') {
            steps {
                bat """
                    kubectl create namespace %KUBE_NAMESPACE% --dry-run=client -o yaml | kubectl apply -f -
                """
                
                dir('kubernetes') {
                    bat """
                        kubectl apply -f mysql-secret.yaml --namespace %KUBE_NAMESPACE%
                        kubectl apply -f mysql-init-configmap.yaml --namespace %KUBE_NAMESPACE%
                        kubectl apply -f mysql-pv.yaml --namespace %KUBE_NAMESPACE%
                        kubectl apply -f mysql-deployment.yaml --namespace %KUBE_NAMESPACE%
                        kubectl apply -f app-deployment.yaml --namespace %KUBE_NAMESPACE%
                        kubectl apply -f app-service.yaml --namespace %KUBE_NAMESPACE%
                    """
                }
            }
        }
    }

    post {
        always {
            bat """
                docker rmi %DOCKER_IMAGE%:%DOCKER_TAG% || echo No image to delete
                docker rmi %DOCKER_IMAGE%:latest || echo No image to delete
            """
        }
    }
}